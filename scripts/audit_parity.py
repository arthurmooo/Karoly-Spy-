import sys
import os
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional
from datetime import datetime

# Add current dir to path to import projectk_core
sys.path.append(os.getcwd())

from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.processing.parser import FitParser

# =============================================================================
# REFERENCE LOGIC (Extracted from Karoly's Notebooks)
# =============================================================================

@dataclass
class ReferenceConfig:
    sport: str
    cp: float
    lt1_hr: int
    lt2_hr: int
    alpha_int: float = 0.50
    beta_dur: float = 0.08
    drift_threshold: float = 3.0
    if_bins: Tuple[Tuple[float, float], ...] = ((0.0, 0.75), (0.75, 0.85), (0.85, 0.92), (0.92, 99.0))
    if_factors: Tuple[float, ...] = (0.8, 1.0, 1.2, 1.4)
    max_dt_s: float = 10.0
    hr_smooth_window_s: int = 30

def reference_preprocess(df: pd.DataFrame, cfg: ReferenceConfig) -> pd.DataFrame:
    df = df.copy()
    if 'timestamp' in df.columns:
        df['time'] = df['timestamp']
    if 'heart_rate' in df.columns:
        df['hr'] = df['heart_rate']
        
    # dt (s)
    df["dt"] = df["time"].diff().dt.total_seconds().fillna(1.0)
    # Pause handling
    df.loc[df["dt"] > cfg.max_dt_s, "dt"] = 0.0
    # Active points with HR
    df_active = df[df["dt"] > 0].copy()
    df_active = df_active.dropna(subset=["hr"])
    
    # Smoothing
    window = max(5, int(cfg.hr_smooth_window_s))
    df_active["hr_smooth"] = df_active["hr"].rolling(window, center=True, min_periods=int(window/3)).mean()
    df_active["hr_smooth"] = df_active["hr_smooth"].ffill().bfill()
    
    return df_active

def reference_compute_metrics(df: pd.DataFrame, cfg: ReferenceConfig, weight: float = 70.0, dist_m: float = 0.0, ascent_m: float = 0.0) -> Dict[str, float]:
    df = df.copy()
    
    # Determine if we use Power or Speed for intensity (Magnitude Rule)
    use_power = cfg.cp > 100.0
    has_power_stream = "power" in df.columns and df["power"].dropna().mean() > 10
    
    if use_power and has_power_stream:
        df["intensity"] = df["power"] / cfg.cp
        intensity_source_is_power = True
    else:
        df["intensity"] = df["speed"] / cfg.cp if "speed" in df.columns else pd.Series(np.zeros(len(df)))
        intensity_source_is_power = False
        
    # MEC Base (Energy)
    if cfg.sport == "bike" and "power" in df.columns:
        energy_kj = (df["power"].fillna(0) * 1.0).sum() / 1000.0
    elif cfg.sport == "run":
        if intensity_source_is_power:
            energy_kj = (df["power"].fillna(0) * 1.0).sum() / 1000.0
        else:
            dist_km = dist_m / 1000.0
            kcal = weight * (dist_km + (ascent_m / 100.0))
            energy_kj = kcal * 4.184
    else:
        energy_kj = 0.0
        
    total_time_s = len(df)
    IF = df["intensity"].mean()
    
    # Zones HR
    z2h = df[(df["hr_smooth"] >= cfg.lt1_hr) & (df["hr_smooth"] < cfg.lt2_hr)].shape[0]
    
    # Split halves
    mid = len(df) // 2
    first = df.iloc[:mid]
    second = df.iloc[mid:]
    
    if use_power and has_power_stream:
        p1 = first["power"].fillna(0).mean()
        p2 = second["power"].fillna(0).mean()
    elif cfg.sport == "bike":
        p1 = first["power"].fillna(0).mean()
        p2 = second["power"].fillna(0).mean()
    else:
        p1 = first["speed"].fillna(0).mean()
        p2 = second["speed"].fillna(0).mean()
        
    hr1 = first["hr_smooth"].mean()
    hr2 = second["hr_smooth"].mean()
    
    pahr_1 = p1 / hr1 if hr1 > 0 else np.nan
    pahr_2 = p2 / hr2 if hr2 > 0 else np.nan
    drift_pahr_pct = (pahr_2 / pahr_1 - 1) * 100 if pahr_1 and not np.isnan(pahr_1) else 0.0
    
    # MEC Intensity Factor
    intensity_factor = 1.0
    for (lo, hi), f in zip(cfg.if_bins, cfg.if_factors):
        if lo <= IF < hi:
            intensity_factor = f
            break
    else:
        intensity_factor = cfg.if_factors[-1]
        
    # MLS
    MEC = energy_kj * intensity_factor
    INT = 1.0 + cfg.alpha_int * (z2h / total_time_s) if total_time_s > 0 else 1.0
    DUR = 1.0 + cfg.beta_dur * max(0.0, abs(drift_pahr_pct) - cfg.drift_threshold)
    MLS = MEC * INT * DUR

    return {
        "total_time_s": float(total_time_s),
        "IF": IF,
        "intensity_factor": intensity_factor,
        "z2h_s": float(z2h),
        "pahr_1": pahr_1,
        "pahr_2": pahr_2,
        "drift_pahr_pct": drift_pahr_pct,
        "MEC": MEC,
        "INT": INT,
        "DUR": DUR,
        "MLS": MLS
    }

# =============================================================================
# AUDIT RUNNER
# =============================================================================

def run_audit(fit_path: str, athlete_profile: Dict[str, Any]):
    print(f"\n--- AUDIT PARITY: {os.path.basename(fit_path)} ---")
    
    # 1. Load
    parser = FitParser()
    df_filled, metadata_raw, laps = parser.parse(fit_path)
    
    sport_type = "bike" if "bike" in fit_path.lower() or "adrien" in fit_path.lower() else "run"
    
    metadata = ActivityMetadata(
        activity_type=sport_type,
        start_time=metadata_raw.get('start_time') or df_filled['timestamp'].iloc[0],
        duration_sec=float((df_filled['timestamp'].iloc[-1] - df_filled['timestamp'].iloc[0]).total_seconds()),
        distance_m=df_filled['distance'].max() if 'distance' in df_filled.columns else 0.0,
        elevation_gain=metadata_raw.get('total_ascent') or 0.0
    )
    activity = Activity(metadata, df_filled, laps)
    
    # 2. Current
    profile = PhysioProfile(
        valid_from=datetime(2026, 1, 1),
        cp_cs=athlete_profile['cp'],
        lt1_hr=athlete_profile['lt1_hr'],
        lt2_hr=athlete_profile['lt2_hr'],
        weight=athlete_profile.get('weight', 70.0)
    )
    
    config = AthleteConfig()
    calculator = MetricsCalculator(config)
    current_metrics = calculator.compute(activity, profile)
    
    # 3. Reference
    ref_cfg = ReferenceConfig(
        sport=sport_type,
        cp=athlete_profile['cp'],
        lt1_hr=athlete_profile['lt1_hr'],
        lt2_hr=athlete_profile['lt2_hr']
    )
    
    ref_prep = reference_preprocess(df_filled, ref_cfg)
    ref_metrics = reference_compute_metrics(
        ref_prep, ref_cfg, 
        weight=athlete_profile.get('weight', 70.0),
        dist_m=metadata.distance_m,
        ascent_m=metadata.elevation_gain
    )
    
    # 4. Comparison
    comparison = [
        ("Duration (s)", ref_metrics['total_time_s'], float(len(activity.streams.dropna(subset=['heart_rate'])))), 
        ("Intensity Factor (IF)", ref_metrics['IF'], current_metrics['intensity_factor']),
        ("Drift Pa:HR (%)", ref_metrics['drift_pahr_pct'], current_metrics['drift_pahr_percent']),
        ("MEC (Load Base)", ref_metrics['MEC'], current_metrics['mec']),
        ("INT Index", ref_metrics['INT'], current_metrics['int_index']),
        ("DUR Index", ref_metrics['DUR'], current_metrics['dur_index']),
        ("MLS Final", ref_metrics['MLS'], current_metrics['mls_load']),
    ]
    
    print(f"{ 'Metric':<25} | { 'Reference':<12} | { 'Current':<12} | { 'Delta':<12}")
    print("-" * 70)
    for name, ref, curr in comparison:
        delta = curr - ref if (curr is not None and ref is not None) else np.nan
        print(f"{name:<25} | {ref:<12.4f} | {curr:<12.4f} | {delta:<12.4f}")

if __name__ == "__main__":
    # 1. Bike Test
    adrien_profile = {'cp': 250.0, 'lt1_hr': 140, 'lt2_hr': 160, 'weight': 68.0}
    fit_bike = "data/test_cache/Adrien_2026-01-07.fit"
    if os.path.exists(fit_bike):
        run_audit(fit_bike, adrien_profile)
    
    # 2. Run Test (Stryd)
    run_profile = {'cp': 300.0, 'lt1_hr': 145, 'lt2_hr': 165, 'weight': 75.0}
    fit_run = "data/samples/allure_semi.fit"
    if os.path.exists(fit_run):
        run_audit(fit_run, run_profile)