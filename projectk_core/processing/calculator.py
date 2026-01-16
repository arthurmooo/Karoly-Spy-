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
        # Duration: Karoly counts active time (rows with HR and valid dt)
        # Assuming 1Hz resampling, active seconds = count of rows with HR
        hr_series = df['heart_rate'].dropna()
        active_seconds = len(hr_series)
        total_seconds = active_seconds # Alias for clarity with notebook 'total_time_s'
        
        if total_seconds == 0:
            return {}

        # 2. Intensity & Power Logic
        # Determine if we use Power (Bike/Stryd) or Speed (Run fallback)
        has_power = 'power' in df.columns and df['power'].mean() > 10
        sport = "bike" if meta.activity_type.lower() in ["bike", "ride", "virtualride", "cycling"] else "run"
        
        if has_power and profile.cp:
            intensity_series = df['power'] / profile.cp
            mech_source = df['power']
            mech_ref = profile.cp
        elif sport == "run" and 'speed' in df.columns and profile.cp:
            # CS (Critical Speed) is stored in cp for runners
            intensity_series = df['speed'] / profile.cp
            mech_source = df['speed']
            mech_ref = profile.cp
        else:
             intensity_series = pd.Series(np.zeros(len(df)))
             mech_source = pd.Series(np.zeros(len(df)))
             mech_ref = 1.0

        # 3. Energy (kJ)
        # Karoly: Bike uses kJ, Run returns None
        if sport == "bike" and 'power' in df.columns:
            energy_kj = df['power'].fillna(0).sum() * 1.0 / 1000.0
        else:
            energy_kj = None

        # 4. IF (Intensity Factor)
        # Mean of intensity series on active points
        if_mean = intensity_series.mean() if not intensity_series.empty else 0.0

        # 5. Mechanical Load (MEC)
        intensity_factor = self._pick_intensity_factor(if_mean)
        mec = energy_kj * intensity_factor if energy_kj is not None else None

        # 6. Internal Load (INT)
        # Based on HR Time in Zone 2 (LT1 <= HR < LT2)
        hr_smooth = df['heart_rate'].rolling(window=30, center=True, min_periods=1).mean()
        hr_smooth = hr_smooth.fillna(method='bfill').fillna(method='ffill')
        
        z2_count = ((hr_smooth >= profile.lt1_hr) & (hr_smooth < profile.lt2_hr)).sum()
        p_hr_lt = z2_count / total_seconds if total_seconds > 0 else 0.0
        
        alpha = self.config.get('alpha_load_hr', 0.5)
        int_index = 1.0 + alpha * p_hr_lt

        # 7. Durability (DUR) & Decoupling
        # Split Halves by time
        mid_idx = len(df) // 2 # 1Hz assumption makes index split equivalent to time split
        
        # Means of first and second half
        p1 = mech_source.iloc[:mid_idx].fillna(0).mean()
        p2 = mech_source.iloc[mid_idx:].fillna(0).mean()
        
        h1 = hr_smooth.iloc[:mid_idx].mean()
        h2 = hr_smooth.iloc[mid_idx:].mean()
        
        pahr_1 = p1 / h1 if h1 > 0 else np.nan
        pahr_2 = p2 / h2 if h2 > 0 else np.nan
        
        if np.isnan(pahr_1) or np.isnan(pahr_2) or pahr_1 == 0:
            drift_pahr_pct = 0.0
        else:
            drift_pahr_pct = (pahr_2 / pahr_1 - 1) * 100
            
        drift_abs = abs(drift_pahr_pct)
        drift_threshold = self.config.get('drift_threshold_percent', 3.0)
        beta = self.config.get('beta_dur', 0.08)
        
        dur_index = 1.0 + beta * max(0.0, drift_abs - drift_threshold)

        # 8. Final MLS
        if mec is not None:
            mls_load = mec * int_index * dur_index
        else:
            mls_load = None

        # 9. Standard Metrics (NP, TSS)
        if has_power:
            p_30s = df['power'].rolling(window=30, center=False, min_periods=1).mean()
            np_val = np.sqrt(np.sqrt( (p_30s ** 4).mean() ))
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
            "energy_kj": round(energy_kj, 1) if energy_kj is not None else None,
            "intensity_factor": round(if_mean, 3),
            "mec": round(mec, 1) if mec is not None else None,
            "int_index": round(int_index, 3),
            "dur_index": round(dur_index, 3),
            "drift_pahr_percent": round(drift_pahr_pct, 2),
            "mls_load": round(mls_load, 1) if mls_load is not None else None,
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
