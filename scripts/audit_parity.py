import sys
import os
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional
from fitparse import FitFile

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

def reference_compute_metrics(df: pd.DataFrame, cfg: ReferenceConfig) -> Dict[str, float]:
    df = df.copy()
    if cfg.sport == "bike":
        df["intensity"] = df["power"] / cfg.cp
        energy_kj = (df["power"] * df["dt"]).sum() / 1000.0
    else: # run
        df["intensity"] = df["speed"] / cfg.cp
        # Note: the notebook had a simpler run model, but let's stick to what's in TrainingLoad.ipynb first
        # For parity, we need to know WHICH notebook formula Karoly considers "Gold Standard"
        energy_kj = None # Will be handled if we have weight/ascent
        
    total_time_s = df["dt"].sum()
    IF = df["intensity"].mean()
    
    # Zones HR
    z2h = df[(df["hr_smooth"] >= cfg.lt1_hr) & (df["hr_smooth"] < cfg.lt2_hr)]["dt"].sum()
    
    # Split halves (TIME BASED)
    t_cum = df["dt"].cumsum()
    half_time = total_time_s / 2.0
    first = df[t_cum <= half_time]
    second = df[t_cum > half_time]
    
    if cfg.sport == "bike":
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
    
    # MEC
    intensity_factor = 1.0
    for (lo, hi), f in zip(cfg.if_bins, cfg.if_factors):
        if lo <= IF < hi:
            intensity_factor = f
            break
    else:
        intensity_factor = cfg.if_factors[-1]
        
    # We need MEC base. For Run, it was added recently via WhatsApp.
    # Let's assume for now we only audit Bike or use a provided weight.
    # TrainingLoad.ipynb logic for Run was missing Energy.
    
    # For now, let's return the components to compare
    return {
        "total_time_s": total_time_s,
        "IF": IF,
        "intensity_factor": intensity_factor,
        "z2h_s": z2h,
        "pahr_1": pahr_1,
        "pahr_2": pahr_2,
        "drift_pahr_pct": drift_pahr_pct
    }

# =============================================================================
# AUDIT SCRIPT
# =============================================================================

def run_audit(fit_path: str, athlete_profile: Dict[str, Any]):
    print(f"\n--- AUDIT PARITY: {os.path.basename(fit_path)} ---")
    
    # 1. Load with Current Parser
    parser = FitParser()
    df_filled, metadata_raw, laps = parser.parse(fit_path)
    
    # Wrap in Activity object
    metadata = ActivityMetadata(
        activity_type="bike", # Force for audit if needed, but FitParser doesn't detect it
        start_time=metadata_raw.get('start_time') or df_filled['timestamp'].iloc[0],
        duration_sec=float((df_filled['timestamp'].iloc[-1] - df_filled['timestamp'].iloc[0]).total_seconds()),
        distance_m=df_filled['distance'].max() if 'distance' in df_filled.columns else 0.0,
        elevation_gain=metadata_raw.get('total_ascent') or 0.0
    )
    activity = Activity(metadata, df_filled, laps)
    
    # 2. Current Calculation
    from datetime import datetime
    profile = PhysioProfile(
        valid_from=datetime(2026, 1, 1),
        cp_cs=athlete_profile['cp'],
        lt1_hr=athlete_profile['lt1_hr'],
        lt2_hr=athlete_profile['lt2_hr'],
        weight=athlete_profile.get('weight', 70.0)
    )
    
    config = AthleteConfig() # Uses defaults
    calculator = MetricsCalculator(config)
    current_metrics = calculator.compute(activity, profile)
    
    # 3. Reference Calculation
    # Need to convert activity.streams to the format expected by reference
    ref_df = activity.streams.copy()
    if 'timestamp' in ref_df.columns:
        ref_df['time'] = ref_df['timestamp']
    if 'heart_rate' in ref_df.columns:
        ref_df['hr'] = ref_df['heart_rate']
        
    ref_cfg = ReferenceConfig(
        sport="bike" if "bike" in activity.metadata.activity_type.lower() else "run",
        cp=athlete_profile['cp'],
        lt1_hr=athlete_profile['lt1_hr'],
        lt2_hr=athlete_profile['lt2_hr']
    )
    
    ref_prep = reference_preprocess(ref_df, ref_cfg)
    ref_metrics = reference_compute_metrics(ref_prep, ref_cfg)
    
    # 4. Comparison Table
    print(f"DEBUG: len(df_filled)={len(df_filled)}")
    print(f"DEBUG: len(df_filled.dropna(subset=['heart_rate']))={len(df_filled.dropna(subset=['heart_rate']))}")
    print(f"DEBUG: Reference active rows={len(ref_prep)}")
    
    comparison = [
        ("Duration (s)", ref_metrics['total_time_s'], float(len(activity.streams))), 
        ("Intensity Factor (IF)", ref_metrics['IF'], current_metrics['intensity_factor']),
        ("Int. Factor (Bin)", ref_metrics['intensity_factor'], calculator._pick_intensity_factor(current_metrics['intensity_factor'])),
        ("Drift Pa:HR (%)", ref_metrics['drift_pahr_pct'], current_metrics['drift_pahr_percent']),
        ("INT Index", 1.0 + 0.5 * (ref_metrics['z2h_s'] / ref_metrics['total_time_s']), current_metrics['int_index']),
    ]
    
    print(f"{ 'Metric':<25} | { 'Reference':<12} | { 'Current':<12} | { 'Delta':<12}")
    print("-" * 70)
    for name, ref, curr, in comparison:
        delta = curr - ref if (curr is not None and ref is not None) else np.nan
        print(f"{name:<25} | {ref:<12.4f} | {curr:<12.4f} | {delta:<12.4f}")

if __name__ == "__main__":
    # Test with Adrien's file (Bike/Power)
    adrien_profile = {
        'cp': 250.0, # Guessing for audit
        'lt1_hr': 140,
        'lt2_hr': 160,
        'weight': 68.0
    }
    
    fit_file = "data/test_cache/Adrien_2026-01-07.fit"
    if os.path.exists(fit_file):
        run_audit(fit_file, adrien_profile)
    else:
        print(f"File {fit_file} not found.")
