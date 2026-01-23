import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from projectk_core.logic.models import Activity, PhysioProfile, SegmentationOutput
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.processing.segmentation import SegmentCalculator
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.processing.lap_calculator import LapCalculator

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

    def _get_sport_category(self, activity_type: str) -> str:
        """Categorizes sport for physiological logic."""
        s = activity_type.lower()
        # Order matters for priority
        if any(x in s for x in ["bike", "ride", "cycling", "vélo", "vtt", "gravel"]):
            return "bike"
        if any(x in s for x in ["strength", "renforcement", "musculation", "ppg", "marche", "gainage"]):
            return "strength"
        if any(x in s for x in ["swim", "natation", "nage"]):
            return "swim"
        if any(x in s for x in ["run", "trail", "hiking", "randonnée", "ski", "course", "rando"]):
            return "run"
        return "other"

    def __init__(self, config: AthleteConfig):
        self.config = config
        self.classifier = ActivityClassifier()
        self.segmenter = SegmentCalculator()
        self.matcher = IntervalMatcher()

    def compute(self, activity: Activity, profile: Optional[PhysioProfile] = None, nolio_type: Optional[str] = None, nolio_comment: Optional[str] = None, target_grid: Optional[List[Dict[str, Any]]] = None, is_competition_nolio: bool = False) -> Dict[str, Any]:
        """
        Computes all metrics for a given activity and athlete profile.
        Includes smart segmentation based on activity classification.
        """
        if activity.empty:
            return {}

        df = activity.streams
        meta = activity.metadata
        sport = self._get_sport_category(meta.activity_type)
        
        # 1. Basic Pre-calc
        # Karoly counts strictly active time (rows with valid dt > 0)
        # We must ignore the resampled gaps for duration-based metrics
        active_df = df[df['heart_rate'].notna()].copy()
        total_seconds = float(len(active_df))
        
        if total_seconds == 0:
            return {}

        # 2. Intensity & Power Logic
        # Magnitude-based source selection (Karoly's Rule):
        # If CP > 100 -> Assume Watts (Bike or Stryd Run)
        # If CP < 20  -> Assume m/s (Run Speed)
        
        cp_value = profile.cp if profile and profile.cp else 0.0
        use_power_as_ref = cp_value > 100.0
        
        # Check if power stream is actually available and valid
        has_power_stream = 'power' in df.columns and df['power'].dropna().mean() > 10
        
        if use_power_as_ref and has_power_stream:
            # High CP + Power available -> Use Power
            intensity_series = active_df['power'] / cp_value
            mech_source = active_df['power']
            mech_ref = cp_value
            has_ref_power = True
        elif sport == "run" and 'speed' in df.columns and cp_value > 0:
            # Default for Run or low CP -> Use Speed
            intensity_series = active_df['speed'] / cp_value
            mech_source = active_df['speed']
            mech_ref = cp_value
            has_ref_power = False
        else:
             # Fallback
             intensity_series = pd.Series(np.zeros(len(active_df)))
             mech_source = pd.Series(np.zeros(len(active_df)))
             mech_ref = 1.0
             has_ref_power = False

        # 3. Energy (kJ) or Mechanical Base
        energy_kj = None
        mec_base = None
        
        if sport == "bike" and 'power' in df.columns:
            # Bike ALWAYS uses mechanical kJ from power if available
            energy_kj = active_df['power'].fillna(0).sum() / 1000.0
            mec_base = energy_kj
        elif sport == "run":
            if has_ref_power:
                # Stryd users: use kJ from power
                energy_kj = active_df['power'].fillna(0).sum() / 1000.0
                mec_base = energy_kj
            else:
                # Standard runners: use weight/distance formula (WhatsApp 2026-01-20)
                weight = profile.weight if profile and profile.weight else 70.0
                dist_km = meta.distance_m / 1000.0 if meta.distance_m else 0.0
                ascent_m = meta.elevation_gain if meta.elevation_gain else 0.0
                kcal = weight * (dist_km + (ascent_m / 100.0))
                energy_kj = kcal * 4.184
                mec_base = energy_kj

        # 4. IF (Intensity Factor)
        if_mean = intensity_series.mean() if not intensity_series.empty else 0.0

        # 5. Mechanical Load (MEC)
        intensity_factor = self._pick_intensity_factor(if_mean)
        mec = (mec_base * intensity_factor) if mec_base is not None else None

        # 6. Internal Load (INT)
        int_index = 1.0
        if 'heart_rate' in active_df.columns and profile and profile.lt1_hr is not None and profile.lt2_hr is not None:
            # Re-apply smoothing ONLY on active data to match notebook
            hr_smooth = active_df['heart_rate'].rolling(window=30, center=True, min_periods=1).mean().ffill().bfill()
            
            z2_count = ((hr_smooth >= profile.lt1_hr) & (hr_smooth < profile.lt2_hr)).sum()
            p_hr_lt = z2_count / total_seconds if total_seconds > 0 else 0.0
            
            alpha = self.config.get('alpha_load_hr', 0.5)
            int_index = 1.0 + alpha * p_hr_lt
        elif 'heart_rate' in active_df.columns:
            # Still need hr_smooth for durability calculation later
            hr_smooth = active_df['heart_rate'].rolling(window=30, center=True, min_periods=1).mean().ffill().bfill()
        else:
            hr_smooth = pd.Series(dtype=float)


        # 7. Durability (DUR) & Decoupling
        dur_index = 1.0
        drift_pahr_pct = 0.0
        
        if total_seconds > 60:
            # Split Halves by TIME (Strictly on active data)
            mid_idx = int(total_seconds // 2)
            
            first_half = active_df.iloc[:mid_idx]
            second_half = active_df.iloc[mid_idx:]
            
            has_speed = 'speed' in active_df.columns
            p1 = first_half['power'].fillna(0).mean() if has_ref_power else (first_half['speed'].fillna(0).mean() if has_speed else 0.0)
            p2 = second_half['power'].fillna(0).mean() if has_ref_power else (second_half['speed'].fillna(0).mean() if has_speed else 0.0)
            
            h1 = hr_smooth.iloc[:mid_idx].mean()
            h2 = hr_smooth.iloc[mid_idx:].mean()
            
            pahr_1 = p1 / h1 if h1 > 0 else np.nan
            pahr_2 = p2 / h2 if h2 > 0 else np.nan
            
            if not (np.isnan(pahr_1) or np.isnan(pahr_2) or pahr_1 == 0):
                drift_pahr_pct = (pahr_2 / pahr_1 - 1) * 100
                
            drift_abs = abs(drift_pahr_pct)
            drift_threshold = self.config.get('drift_threshold_percent', 3.0)
            beta = self.config.get('beta_dur', 0.08)
            dur_index = 1.0 + beta * max(0.0, drift_abs - drift_threshold)

        # 8. Final MLS
        # Karoly's Rule: No thresholds = No MLS (set to null)
        # NEW: Restricted to Running and Cycling only.
        is_eligible_sport = False
        if sport == "bike":
            is_eligible_sport = True
        elif sport == "run":
            # Exclude non-running activities that might be in the 'run' category (Hiking, Ski, etc.)
            if not any(x in meta.activity_type.lower() for x in ["hiking", "randonnée", "ski", "rando"]):
                is_eligible_sport = True

        if is_eligible_sport and mec is not None and profile and profile.lt1_hr is not None and profile.lt2_hr is not None:
            mls_load = mec * int_index * dur_index
        else:
            mls_load = None

        # 9. Standard Metrics (NP, TSS)
        if has_power_stream:
            p_30s = df['power'].rolling(window=30, center=False, min_periods=1).mean()
            np_val = np.sqrt(np.sqrt( (p_30s ** 4).mean() ))
            if_tss = np_val / profile.cp if profile and profile.cp else 0
            tss = (total_seconds * np_val * if_tss) / (profile.cp * 3600) * 100 if profile and profile.cp else 0
        else:
            np_val = 0.0
            tss = 0.0

        # 4. Detect Work Type
        meta.work_type = self.classifier.detect_work_type(df, meta.activity_name or "", nolio_type or "", target_grid=target_grid, is_competition_nolio=is_competition_nolio)

        # 10. Interval Metrics (Requested by Karoly)
        # We now have two modes: LAP-based (legacy) and MATCHER-based (surgical)
        
        avg_intervals_power = 0.0
        avg_intervals_hr = 0.0
        avg_intervals_pace = None
        last_interval_power = 0.0
        last_interval_hr = 0.0
        last_interval_pace = None
        global_respect_score = None

        if meta.work_type == "intervals" and target_grid:
            # SURGICAL MODE
            detections = self.matcher.match(df, target_grid, sport=sport)
            if detections:
                valid_p = [d['avg_power'] for d in detections if d['avg_power'] is not None]
                valid_s = [d['avg_speed'] for d in detections if d['avg_speed'] is not None]
                valid_h = [d['avg_hr'] for d in detections if d['avg_hr'] is not None]
                valid_r = [d['respect_score'] for d in detections if d['respect_score'] is not None]
                
                if valid_p:
                    avg_intervals_power = sum(valid_p) / len(valid_p)
                    last_interval_power = valid_p[-1]
                
                if valid_s:
                    # Convert speed (m/s) to pace (min/km) for display
                    def s_to_p(s): return 1000.0 / s / 60.0 if s > 0 else 0
                    avg_intervals_pace = s_to_p(sum(valid_s) / len(valid_s))
                    last_interval_pace = s_to_p(valid_s[-1])
                
                if valid_h:
                    avg_intervals_hr = sum(valid_h) / len(valid_h)
                    last_interval_hr = valid_h[-1]
                
                if valid_r:
                    global_respect_score = sum(valid_r) / len(valid_r)
        else:
            # LAP-BASED MODE (Fallback)
            # Weighted averages for all intervals (laps) using Recalculated Durations
            # This ensures we respect Moving Time (vs Elapsed) for performance metrics.
            
            clean_laps = []
            for l in activity.laps:
                recalc = LapCalculator.recalculate(l)
                clean_laps.append({
                    **l,
                    'effective_duration': recalc['effective_duration']
                })

            total_lap_time = sum(l.get('effective_duration', 0) for l in clean_laps)
            
            if total_lap_time > 0:
                valid_p_laps = [l for l in clean_laps if l.get('avg_power') is not None]
                valid_hr_laps = [l for l in clean_laps if l.get('avg_heart_rate') is not None]
                
                p_time = sum(l.get('effective_duration', 0) for l in valid_p_laps)
                hr_time = sum(l.get('effective_duration', 0) for l in valid_hr_laps)
                
                avg_intervals_power = sum(l.get('avg_power', 0) * l.get('effective_duration', 0) for l in valid_p_laps) / p_time if p_time > 0 else 0.0
                avg_intervals_hr = sum(l.get('avg_heart_rate', 0) * l.get('effective_duration', 0) for l in valid_hr_laps) / hr_time if hr_time > 0 else 0.0
                
                if clean_laps:
                    last_lap = clean_laps[-1]
                    last_interval_power = last_lap.get('avg_power', 0) or 0
                    last_interval_hr = last_lap.get('avg_heart_rate', 0) or 0

        # 11. Smart Segmentation (Karoly's Request)
        # Determine strategy - Use activity name (title) for keyword detection
        strategy = self.classifier.get_strategy(meta.activity_name or "", nolio_type or "", nolio_comment or "", is_competition_nolio=is_competition_nolio)
        sport_cat = self._get_sport_category(meta.activity_type)
        
        seg_output = SegmentationOutput(segmentation_type=strategy)
        
        if strategy == "manual":
            manual_config = self.classifier.parse_splits(nolio_comment)
            seg_output.manual = self.segmenter.manual_split(df, manual_config, sport_cat)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.manual)
        elif strategy == "auto_competition":
            # 2 phases AND 4 phases for competition
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, sport_cat)
            seg_output.splits_4 = self.segmenter.auto_split(df, 4, sport_cat)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.splits_2)
        else: # auto_training
            # Systematic 2 phases AND 4 phases for continuous training
            # (4 phases stored for future dashboard, 2 phases used for primary KPI)
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, sport_cat)
            seg_output.splits_4 = self.segmenter.auto_split(df, 4, sport_cat)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.splits_2)

        return {
            "interval_power_last": round(float(last_interval_power), 1),
            "interval_hr_last": round(float(last_interval_hr), 1),
            "interval_power_mean": round(float(avg_intervals_power), 1),
            "interval_hr_mean": round(float(avg_intervals_hr), 1),
            "interval_pace_last": round(float(last_interval_pace), 2) if last_interval_pace else None,
            "interval_pace_mean": round(float(avg_intervals_pace), 2) if avg_intervals_pace else None,
            "interval_respect_score": round(float(global_respect_score), 1) if global_respect_score else None,
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
