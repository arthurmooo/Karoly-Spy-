import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional
from projectk_core.logic.models import Activity, PhysioProfile, SegmentationOutput
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.processing.segmentation import SegmentCalculator

class MetricsCalculator:
    """
    Core calculation engine for Project K.
    Implements vectorized physiological metrics and Karoly's Mixed Load Model (MLS).
    Now includes smart segmentation for competition and training analysis.
    """
    
    # Hardcoded bins from Karoly's notebook (could be moved to DB config later)
    IF_BINS = (
        (0.0, 0.75), 
        (0.75, 0.85), 
        (0.85, 0.92), 
        (0.92, 99.9)
    )
    IF_FACTORS = (0.8, 1.0, 1.2, 1.4)

    def __init__(self, config: AthleteConfig):
        self.config = config
        self.classifier = ActivityClassifier()
        self.segmenter = SegmentCalculator()

    def compute(self, activity: Activity, profile: PhysioProfile, nolio_type: Optional[str] = None, nolio_comment: Optional[str] = None) -> Dict[str, Any]:
        """
        Computes all metrics for a given activity and athlete profile.
        Includes smart segmentation based on activity classification.
        """
        if activity.empty:
            return {}

        df = activity.streams
        meta = activity.metadata
        
        # ... (keep existing calculations) ...
        # (I will perform a partial replace to keep the existing logic intact)
        
        # 1. Basic Pre-calc
        # Duration (dt is 1s because of resampling, but let's be robust)
        # Assuming 1Hz resampling from Parser
        dt = 1.0 
        total_seconds = len(df)
        
        # 2. Intensity & Power Logic
        # Determine if we use Power (Bike/Stryd) or Speed (Run fallback)
        # Note: Karoly's logic uses Power for Bike and Speed for Run.
        # But 'allure_semi.fit' is a Run with Power.
        # Strategy: If Power exists and is valid (>0 mean), use Power for Load.
        # If not, use Speed/CS.
        
        has_power = 'power' in df.columns and df['power'].mean() > 10
        
        if has_power and profile.cp:
            intensity_series = df['power'] / profile.cp
            mech_source = df['power']
            mech_ref = profile.cp
        elif 'speed' in df.columns and hasattr(profile, 'cs') and profile.cs: # TODO: Add CS to profile
            # Fallback if no power but speed + CS (Critical Speed)
            # For now, if no CS, we might be stuck. 
            # Let's assume CP is used as a proxy or we default.
            # If profile.cp is treated as CS for run in config?
            # Let's use CP as the reference denominator for now.
            intensity_series = df['speed'] / profile.cp # Risk here if CP is Watts
            mech_source = df['speed']
            mech_ref = profile.cp
        elif has_power and profile.cp: # Duplicate branch? No, logic above covers it.
             # Fallback: simple default
             intensity_series = df['power'] * 0 # invalid
             mech_source = df['power']
             mech_ref = 1
        else:
             # Critical fail or return partial
             intensity_series = pd.Series(np.zeros(len(df)))
             mech_source = pd.Series(np.zeros(len(df)))
             mech_ref = 1

        # 3. Energy (kJ) & Intensity Fallback
        # Only valid for Power. For speed, Karoly returns None.
        if has_power:
            # sum(Watts * seconds) / 1000 = kJ
            # We assume NaNs are 0 (coast/stop)
            energy_kj = df['power'].fillna(0).sum() * dt / 1000.0
        elif 'heart_rate' in df.columns and profile.lt2_hr:
            # FALLBACK: Estimate Energy/Power via HR if no power meter
            # Very rough proxy: IF ~ HR / LT2_HR (assuming LT2 is roughly FTP HR)
            # Power ~ IF * CP
            hr_avg = df['heart_rate'].mean()
            if_est = hr_avg / profile.lt2_hr if profile.lt2_hr else 0.6
            power_est = if_est * profile.cp if profile.cp else 150
            energy_kj = (power_est * total_seconds) / 1000.0
            
            # Update intensity series for IF calc later
            # We construct a synthetic constant intensity series
            intensity_series = pd.Series([if_est] * len(df))
            mech_source = pd.Series([power_est] * len(df)) # Synthetic flat power
        else:
            energy_kj = 0.0 # Or None, but float logic prefers 0.0

        # 4. IF (Intensity Factor)
        # Mean of intensity series (zeros included? Yes, IF includes zeros usually)
        # Karoly's notebook: df["intensity"].mean() (includes zeros if present)
        if_mean = intensity_series.mean() if not intensity_series.empty else 0.0

        # 5. Mechanical Load (MEC)
        # f_int based on IF
        f_int = self._pick_intensity_factor(if_mean)
        mec = energy_kj * f_int

        # 6. Internal Load (INT)
        # Based on HR Time in Zone 2 (LT1 <= HR < LT2)
        if 'heart_rate' in df.columns:
            hr = df['heart_rate'].fillna(0)
            # We assume HR is already smoothed if needed, or we smooth here.
            # Karoly does 30s rolling smooth. Let's do it.
            hr_smooth = hr.rolling(window=30, center=True, min_periods=1).mean().fillna(method='bfill').fillna(method='ffill')
            
            # Time in Zones
            # z1 = (hr_smooth < profile.lt1_hr).sum()
            z2_count = ((hr_smooth >= profile.lt1_hr) & (hr_smooth < profile.lt2_hr)).sum()
            # z3 = (hr_smooth >= profile.lt2_hr).sum()
            
            p_hr_lt = z2_count / total_seconds if total_seconds > 0 else 0.0
            
            alpha = self.config.get('alpha_load_hr', 0.5)
            int_index = 1.0 + alpha * p_hr_lt
        else:
            int_index = 1.0
            hr_smooth = pd.Series(np.zeros(len(df)))

        # 7. Durability (DUR) & Decoupling
        # Split Halves
        mid_idx = total_seconds // 2
        
        # Means of first and second half
        # Note: Karoly uses non-zero values for averages usually, or keeps zeros?
        # Code: "first['power'].mean()". Includes zeros.
        
        if not mech_source.empty and has_power: # Only calc drift if real power source
            p1 = mech_source.iloc[:mid_idx].mean()
            p2 = mech_source.iloc[mid_idx:].mean()
            
            h1 = hr_smooth.iloc[:mid_idx].mean()
            h2 = hr_smooth.iloc[mid_idx:].mean()
            
            pahr_1 = p1 / h1 if h1 > 0 else np.nan
            pahr_2 = p2 / h2 if h2 > 0 else np.nan
            
            if np.isnan(pahr_1) or np.isnan(pahr_2) or pahr_1 == 0:
                drift_pahr_pct = 0.0
            else:
                drift_pahr_pct = (pahr_2 / pahr_1 - 1) * 100
        else:
            # No power -> No Pa:HR drift possible
            drift_pahr_pct = 0.0
            
        drift_abs = abs(drift_pahr_pct)
        drift_threshold = self.config.get('drift_threshold_percent', 3.0)
        beta = self.config.get('beta_dur', 0.08)
        
        dur_index = 1.0 + beta * max(0.0, drift_abs - drift_threshold)

        # 8. Final MLS
        mls_load = mec * int_index * dur_index

        # 9. Standard Metrics (NP, TSS)
        # NP = cubic mean of 30s smoothed power
        if has_power:
            # rolling 30s mean
            p_30s = df['power'].rolling(window=30, center=False, min_periods=1).mean()
            # raise to 4th power (Allen & Coggan is 4th, not cubic? Wait. NP formula is 4th power)
            # "The summation of the values to the fourth power..."
            np_val = np.sqrt(np.sqrt( (p_30s ** 4).mean() ))
            
            # TSS = (sec x NP x IF) / (FTP x 3600) x 100
            # IF for TSS is NP / FTP.
            # Caution: Karoly's IF is AvgPower / CP.
            # Standard TSS IF is NP / FTP.
            # Let's calculate standard TSS using CP as FTP proxy.
            if_tss = np_val / profile.cp if profile.cp else 0
            tss = (total_seconds * np_val * if_tss) / (profile.cp * 3600) * 100 if profile.cp else 0
        else:
            np_val = 0.0
            tss = 0.0

        # 10. Interval Metrics (Requested by Karoly)
        # We use the laps extracted by the parser
        last_lap = activity.laps[-1] if activity.laps else {}
        
        # Weighted averages for all intervals (laps)
        total_lap_time = sum(l.get('total_elapsed_time', 0) for l in activity.laps)
        if total_lap_time > 0:
            # We filter out laps with 0 or None to avoid dragging down the average if some laps are empty
            valid_p_laps = [l for l in activity.laps if l.get('avg_power') is not None]
            valid_hr_laps = [l for l in activity.laps if l.get('avg_heart_rate') is not None]
            
            p_time = sum(l.get('total_elapsed_time', 0) for l in valid_p_laps)
            hr_time = sum(l.get('total_elapsed_time', 0) for l in valid_hr_laps)
            
            avg_intervals_power = sum(l.get('avg_power', 0) * l.get('total_elapsed_time', 0) for l in valid_p_laps) / p_time if p_time > 0 else 0.0
            avg_intervals_hr = sum(l.get('avg_heart_rate', 0) * l.get('total_elapsed_time', 0) for l in valid_hr_laps) / hr_time if hr_time > 0 else 0.0
        else:
            avg_intervals_power = 0.0
            avg_intervals_hr = 0.0

        # 11. Smart Segmentation (Karoly's Request)
        # Determine strategy
        strategy = self.classifier.get_strategy(meta.activity_type, nolio_type or "", nolio_comment or "")
        sport = "bike" if meta.activity_type.lower() in ["bike", "ride", "virtualride", "cycling"] else "run"
        
        seg_output = SegmentationOutput(segmentation_type=strategy)
        
        if strategy == "manual":
            manual_config = self.classifier.parse_splits(nolio_comment)
            seg_output.manual = self.segmenter.manual_split(df, manual_config, sport)
        elif strategy == "auto_competition":
            # 2 phases AND 4 phases for competition
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, sport)
            seg_output.splits_4 = self.segmenter.auto_split(df, 4, sport)
        else: # auto_training
            # Systematic 2 phases for continuous training
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, sport)

        return {
            "interval_power_last": round(float(last_lap.get('avg_power', 0) or 0), 1),
            "interval_hr_last": round(float(last_lap.get('avg_heart_rate', 0) or 0), 1),
            "interval_power_mean": round(avg_intervals_power, 1),
            "interval_hr_mean": round(avg_intervals_hr, 1),
            "energy_kj": round(energy_kj, 1),
            "intensity_factor": round(if_mean, 3),
            "mec": round(mec, 1),
            "int_index": round(int_index, 3),
            "dur_index": round(dur_index, 3),
            "drift_pahr_percent": round(drift_pahr_pct, 2),
            "mls_load": round(mls_load, 1),
            "normalized_power": round(np_val, 1),
            "tss": round(tss, 1),
            "segmented_metrics": seg_output
        }

    def _pick_intensity_factor(self, if_val: float) -> float:
        """
        Selects the multiplication factor based on the Intensity Factor bin.
        """
        # We iterate over the bins defined in the class (or config)
        # IF_BINS = ((0.0, 0.75), (0.75, 0.85), ...)
        # IF_FACTORS = (0.8, 1.0, ...)
        
        for (lo, hi), factor in zip(self.IF_BINS, self.IF_FACTORS):
            if lo <= if_val < hi:
                return factor
        
        # If above all bins (e.g. > 0.92)
        return self.IF_FACTORS[-1]
