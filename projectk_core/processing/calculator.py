import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from projectk_core.logic.models import Activity, PhysioProfile, SegmentationOutput
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.processing.segmentation import SegmentCalculator
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.processing.lap_calculator import LapCalculator
from projectk_core.processing.confidence import VALIDATION_THRESHOLD, is_high_confidence_match

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
        if 'heart_rate' in df.columns:
            active_df = df[df['heart_rate'].notna()].copy()
        else:
            # Fallback if no heart rate data: use all rows or speed/power if available
            active_df = df.copy()
            
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
                # UPDATE 2026-02-01: Removed 4.184 factor to align Run with Bike (Calorie-equivalent)
                weight = profile.weight if profile and profile.weight else 70.0
                dist_km = meta.distance_m / 1000.0 if meta.distance_m else 0.0
                ascent_m = meta.elevation_gain if meta.elevation_gain else 0.0
                
                # Base Mechanical Cost = Weight * (Distance_km + Ascent_km)
                # Ascent logic: 100m D+ = 1km plat (so D+ / 100 adds to km)
                kcal = weight * (dist_km + (ascent_m / 100.0))
                
                # CALIBRATION 2026-02-01:
                # After removing 4.184 factor, we observed that Run MLS was still ~30% higher than Bike MLS
                # for equivalent effort (1h @ 120bpm).
                # We apply a coefficient of 0.77 to align the baselines.
                # Target: 1h Run @ 120bpm = 1h Bike @ 120bpm
                RUN_COEFF = 0.77
                
                energy_kj = kcal * RUN_COEFF
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
        
        # Minimum duration to calculate meaningful drift
        if total_seconds > 60:
            # Karoly's Logic Update (2026-01-23):
            # If session > 20min, exclude first 10min (warmup) to avoid artifacts
            start_idx = 0
            if total_seconds > 1200: # 20 minutes
                start_idx = 600 # Skip first 600s
            
            analysis_df = active_df.iloc[start_idx:]
            analysis_len = len(analysis_df)
            
            if analysis_len > 60:
                mid_idx = int(analysis_len // 2)
                
                first_half = analysis_df.iloc[:mid_idx]
                second_half = analysis_df.iloc[mid_idx:]
                
                # Determine source for decoupling (Power or Speed) based on profile reliability
                has_speed = 'speed' in active_df.columns
                
                # If we have reliable power (CP > 100), use Power. Otherwise Speed.
                # This filters out unreliable wrist power if the coach hasn't set a Watt-based CP.
                # KAROLY UPDATE: Run = Vitesse (Always use Speed for Run)
                use_power_drift = has_ref_power and sport != 'run'
                
                if use_power_drift:
                    p1_s = first_half['power'].dropna()
                    val1 = p1_s[p1_s > 0].mean() if not p1_s.empty else 0.0
                    p2_s = second_half['power'].dropna()
                    val2 = p2_s[p2_s > 0].mean() if not p2_s.empty else 0.0
                else:
                    val1 = first_half['speed'].fillna(0).mean() if has_speed else 0.0
                    val2 = second_half['speed'].fillna(0).mean() if has_speed else 0.0
                
                h1 = hr_smooth.iloc[start_idx:start_idx+mid_idx].mean()
                h2 = hr_smooth.iloc[start_idx+mid_idx:].mean()
                
                ratio_1 = val1 / h1 if h1 > 0 else np.nan
                ratio_2 = val2 / h2 if h2 > 0 else np.nan
                
                if not (np.isnan(ratio_1) or np.isnan(ratio_2) or ratio_1 == 0):
                    drift_pahr_pct = (ratio_2 / ratio_1 - 1) * 100
                
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
        meta.work_type = self.classifier.detect_work_type(
            df, 
            meta.activity_name or "", 
            nolio_type or "", 
            sport_name=meta.activity_type or "",
            target_grid=target_grid, 
            is_competition_nolio=is_competition_nolio,
            laps=activity.laps
        )

        # 10. Interval Metrics (Requested by Karoly)
        # We now have two modes: LAP-based (legacy) and MATCHER-based (surgical)
        
        avg_intervals_power = None
        avg_intervals_hr = None
        avg_intervals_pace = None
        last_interval_power = None
        last_interval_hr = None
        last_interval_pace = None
        global_respect_score = None
        interval_detection_source = None
        detected_blocks = []
        
        # New Pa:HR (or Speed:HR) metrics
        interval_pahr_mean = None
        interval_pahr_last = None
        interval_blocks_summary = []
        
        # Determine which signal to use for efficiency ratio (Power or Speed)
        # KAROLY UPDATE: Run = Vitesse (Always use Speed for Run)
        # Bike = Power
        eff_signal_col = 'power' if sport == 'bike' else 'speed'

        # Karoly 2026-02-02: Pre-correct Lap averages from stream (Wmoy = no zeros)
        # This ensures both matcher classification and final display are consistent.
        if sport == 'bike' and 'power' in df.columns and activity.laps:
            ts_series = pd.to_datetime(df['timestamp']) if 'timestamp' in df.columns else None
            if ts_series is not None:
                for l in activity.laps:
                    try:
                        start_ts = l.get('start_time')
                        # Duration in laps can be total_timer_time or total_elapsed_time
                        dur = l.get('total_timer_time') or l.get('total_elapsed_time')
                        if start_ts and dur:
                            start_idx = int(ts_series.searchsorted(pd.to_datetime(start_ts)))
                            end_idx = start_idx + int(round(dur))
                            pwr_seg = df['power'].iloc[start_idx:end_idx].dropna()
                            if not pwr_seg.empty:
                                l['avg_power'] = float(pwr_seg[pwr_seg > 0].mean())
                    except:
                        pass

        # STRICT RULE: Only compute interval metrics for "intervals" work type
        # AND only for Running and Cycling (requested 2026-02-03)
        if meta.work_type == "intervals" and sport in ["run", "bike"]:
            if target_grid:
                # SURGICAL MODE
                # Pass CP to help the matcher classify LAPs correctly
                athlete_cp = profile.cp if profile else None
                detections = self.matcher.match(df, target_grid, sport=sport, laps=activity.laps, cp=athlete_cp)
                if detections:
                    from projectk_core.logic.models import IntervalBlock, DetectionSource
                    
                    valid_p = [d['avg_power'] for d in detections if d['avg_power'] is not None]
                    valid_s = [d['avg_speed'] for d in detections if d['avg_speed'] is not None]
                    valid_h = [d['avg_hr'] for d in detections if d['avg_hr'] is not None]
                    valid_r = [d['respect_score'] for d in detections if d['respect_score'] is not None]
                    
                    # Determine source from majority of detections
                    sources = [d.get('source') for d in detections if d.get('source')]
                    if sources:
                        interval_detection_source = max(set(sources), key=sources.count)
                    else:
                        interval_detection_source = "plan" # Default fallback if status was matched
                    
                    # Create IntervalBlock objects for the DB
                    for d in detections:
                        detection_source_enum = DetectionSource.LAP if d['source'] == 'lap' else DetectionSource.ALGO
                        block = IntervalBlock(
                            start_time=float(d['start_index']),
                            end_time=float(d['end_index']),
                            type=d['target'].get('type', 'active'),
                            detection_source=detection_source_enum,
                            avg_power=d.get('avg_power'),
                            avg_speed=d.get('avg_speed'),
                            avg_hr=d.get('avg_hr'),
                            respect_score=d.get('respect_score')
                        )
                        detected_blocks.append(block)

                    # ROBUSTNESS: Filter for Performance Averages
                    # We only include intervals that meet a minimum intensity respect score (82%)
                    # to avoid including warmups that match the duration of a work block.
                    perf_detections = [d for d in detections if d.get('respect_score') is not None and d.get('respect_score') >= 82.0]
                    
                    # If everything is below 82%, we fall back to all detections to avoid 0,
                    # but we'll print a warning in the logs.
                    if not perf_detections:
                        perf_detections = detections

                    # ===== ROBUST RUN FILTER (2026-02-11) =====
                    # Remove obvious low-speed outliers likely to be recovery bleed.
                    # IMPORTANT: Do NOT remove long blocks here; multi-block sessions are
                    # now handled as separate interval blocks (5x1km + 9km tempo).
                    if sport == "run" and len(perf_detections) >= 4:
                        run_with_speed = [d for d in perf_detections if d.get('avg_speed') and d.get('avg_speed') > 0]
                        if run_with_speed:
                            speeds = sorted([float(d.get('avg_speed')) for d in perf_detections if d.get('avg_speed') and d.get('avg_speed') > 0])
                            if len(speeds) >= 4:
                                mid = len(speeds) // 2
                                median_speed = speeds[mid] if len(speeds) % 2 == 1 else (speeds[mid - 1] + speeds[mid]) / 2.0
                                low_speed_floor = median_speed * 0.85
                                outlier_filtered = [d for d in perf_detections if (d.get('avg_speed') is None) or (d.get('avg_speed') >= low_speed_floor)]
                                if len(outlier_filtered) >= max(3, int(len(perf_detections) * 0.7)):
                                    perf_detections = outlier_filtered

                    valid_p = [d['avg_power'] for d in perf_detections if d['avg_power'] is not None]
                    valid_s = [d['avg_speed'] for d in perf_detections if d['avg_speed'] is not None]
                    valid_h = [d['avg_hr'] for d in perf_detections if d['avg_hr'] is not None]
                    valid_r = [d['respect_score'] for d in perf_detections if d['respect_score'] is not None]

                    # ========== CONFIDENCE-BASED VALIDATION (2026-02-02) ==========
                    # Rule: Populate aggregate metrics if EITHER:
                    # 1. 100% LAP match (legacy strict rule), OR
                    # 2. >= 95% match with all signal detections having confidence >= 0.85

                    num_planned = len(target_grid)
                    num_matched = len(detections)
                    all_laps = all(d.get('source') == 'lap' for d in detections)
                    lap_ratio = (len([d for d in detections if d.get('source') == 'lap']) / num_matched) if num_matched > 0 else 0.0

                    # Check for high-confidence signal match (new)
                    is_high_confidence_signal = is_high_confidence_match(
                        detections,
                        num_planned,
                        threshold=VALIDATION_THRESHOLD
                    )
                    single_block_signal_ok = (
                        num_planned == 1 and
                        num_matched == 1 and
                        detections[0].get('source') == 'signal' and
                        (detections[0].get('confidence', 0) >= 0.60)
                    )

                    # ===== COMPLETION THRESHOLD (2026-02-04, adaptive 2026-03-05) =====
                    # Adaptive threshold: small sets (≤3 reps) accept 50% because
                    # 1/2=50% is the only non-zero option below 100%.
                    completion_ratio = num_matched / num_planned if num_planned > 0 else 0
                    if num_planned <= 3:
                        min_completion = 0.50  # 1/2 or 2/3 suffices
                    elif num_planned <= 5:
                        min_completion = 0.60  # 3/5 suffices
                    else:
                        min_completion = 0.70  # standard threshold
                    meets_completion_threshold = completion_ratio >= min_completion

                    # Valid match: meets completion AND (all LAPs or high-confidence signal)
                    is_valid_match = meets_completion_threshold and (
                        (num_matched >= num_planned and all_laps) or  # Perfect LAP match
                        (all_laps and completion_ratio >= 0.80) or  # LAP quasi-complete (e.g. 5/6)
                        (completion_ratio >= 0.95 and lap_ratio >= 0.90) or  # LAP-dominant near-complete
                        (num_matched >= num_planned) or  # All planned intervals found (any source)
                        is_high_confidence_signal or  # High-confidence signal match
                        single_block_signal_ok  # Single long block with adequate signal confidence
                    )

                    if is_valid_match:
                        # Log match type for debugging
                        match_type = "LAP" if all_laps else "SIGNAL (high-confidence)"
                        print(f"      ✅ Valid {match_type} match: {num_matched}/{num_planned} intervals")

                        interval_blocks_summary = self._build_interval_blocks_summary_from_detections(perf_detections, sport)
                        primary_block = self._pick_primary_interval_block(interval_blocks_summary)

                        if primary_block:
                            avg_intervals_power = primary_block.get("interval_power_mean")
                            avg_intervals_hr = primary_block.get("interval_hr_mean")
                            avg_intervals_pace = primary_block.get("interval_pace_mean")
                            last_interval_power = primary_block.get("interval_power_last")
                            last_interval_hr = primary_block.get("interval_hr_last")
                            last_interval_pace = primary_block.get("interval_pace_last")
                            global_respect_score = primary_block.get("interval_respect_score_mean")
                            interval_pahr_mean = primary_block.get("interval_pahr_mean")
                            interval_pahr_last = primary_block.get("interval_pahr_last")
                    else:
                        # NOT A VALID MATCH: Keep individual detected blocks
                        # but leave summary metrics at NULL
                        avg_intervals_power = None
                        avg_intervals_hr = None
                        avg_intervals_pace = None
                        last_interval_power = None
                        last_interval_hr = None
                        last_interval_pace = None
                        interval_pahr_mean = None
                        interval_pahr_last = None
                        global_respect_score = None
                        interval_blocks_summary = []

                        # Log the reason for NULL metrics
                        if not meets_completion_threshold:
                            reason = f"Session incomplète ({num_matched}/{num_planned} = {completion_ratio*100:.0f}% < 70%)"
                        elif num_matched < num_planned:
                            reason = f"Partial match ({num_matched}/{num_planned})"
                        else:
                            # Check signal confidence
                            signal_dets = [d for d in detections if d.get('source') == 'signal']
                            low_conf = [d for d in signal_dets if d.get('confidence', 0) < VALIDATION_THRESHOLD]
                            if low_conf:
                                avg_conf = sum(d.get('confidence', 0) for d in low_conf) / len(low_conf)
                                reason = f"Low signal confidence ({avg_conf:.2f} < {VALIDATION_THRESHOLD})"
                            else:
                                reason = "Mixed sources (SIGNAL used)"
                        print(f"      ⚠️  Interval metrics set to NULL: {reason}")
                    # ================================================================================
                    
            else:
                # LAP-BASED MODE (Fallback)
                # Weighted averages for all intervals (laps) using Recalculated Durations
                # This ensures we respect Moving Time (vs Elapsed) for performance metrics.
                
                clean_laps = []
                # For surgical indexing if needed
                ts_series = pd.to_datetime(df['timestamp']) if 'timestamp' in df.columns else None
                
                for l in activity.laps:
                    recalc = LapCalculator.recalculate(l)
                    lap_entry = {
                        **l,
                        'effective_duration': recalc['effective_duration']
                    }
                    
                    # Karoly 2026-02-02: Recalculate power mean excluding zeros from stream
                    if sport == 'bike' and 'power' in df.columns and ts_series is not None:
                        try:
                            start_ts = l.get('start_time')
                            duration = int(recalc['effective_duration'])
                            if start_ts:
                                start_idx = int(ts_series.searchsorted(pd.to_datetime(start_ts)))
                                end_idx = start_idx + duration
                                pwr_seg = df['power'].iloc[start_idx:end_idx].dropna()
                                if not pwr_seg.empty:
                                    # Use Wmoy (exclude zeros)
                                    lap_entry['avg_power'] = float(pwr_seg[pwr_seg > 0].mean())
                        except Exception as e:
                            print(f"      ⚠️ Failed to recalculate lap power from stream: {e}")
                            
                    clean_laps.append(lap_entry)

                # SMART FALLBACK: Filter out Warmup/Cooldown and Recovery
                # Rule: Keep only laps that have > 100% of global avg intensity
                # (effectively keeps only the 'work' parts of an interval session)
                # AND exclude the very first and very last if they look like WU/CD (> 5 min)
                if clean_laps:
                    # Karoly 2026-02-02: global_avg should exclude zeros for power (Wmoy)
                    if eff_signal_col == 'power' and 'power' in df.columns:
                        pwr_all = df['power'].dropna()
                        global_avg = pwr_all[pwr_all > 0].mean() if not pwr_all.empty else 0
                    else:
                        global_avg = df[eff_signal_col].mean() if eff_signal_col in df.columns else 0
                    
                    filtered_laps = []
                    for i, l in enumerate(clean_laps):
                        is_first_last = (i == 0 or i == len(clean_laps) - 1)
                        dur = l.get('effective_duration', 0)
                        val = l.get('avg_power') if eff_signal_col == 'power' else l.get('avg_speed')
                        
                        # Heuristic for Work Lap
                        is_work = True
                        if is_first_last and dur > 300: # Exclude if > 5 min at start/end
                            is_work = False
                        
                        # If it's a running session, we look at speed. 
                        # If it's bike, we look at power.
                        # We must be ABOVE average to be a work interval.
                        if val and global_avg > 0 and val <= global_avg: 
                            is_work = False
                        
                        if is_work:
                            filtered_laps.append(l)
                    
                    # If we filtered everything, keep everything to avoid 0
                    work_laps = filtered_laps if filtered_laps else clean_laps
                    if work_laps:
                        interval_detection_source = "lap"
                else:
                    work_laps = []

                total_lap_time = sum(l.get('effective_duration', 0) for l in work_laps)
                
                if total_lap_time > 0:
                    valid_p_laps = [l for l in work_laps if l.get('avg_power') is not None]
                    valid_hr_laps = [l for l in work_laps if l.get('avg_heart_rate') is not None]
                    valid_s_laps = [l for l in work_laps if l.get('avg_speed') is not None]
                    
                    p_time = sum(l.get('effective_duration', 0) for l in valid_p_laps)
                    hr_time = sum(l.get('effective_duration', 0) for l in valid_hr_laps)
                    s_time = sum(l.get('effective_duration', 0) for l in valid_s_laps)
                    
                    avg_intervals_power = sum(l.get('avg_power', 0) * l.get('effective_duration', 0) for l in valid_p_laps) / p_time if p_time > 0 else None
                    avg_intervals_hr = sum(l.get('avg_heart_rate', 0) * l.get('effective_duration', 0) for l in valid_hr_laps) / hr_time if hr_time > 0 else None
                    
                    if s_time > 0:
                        avg_speed = sum(l.get('avg_speed', 0) * l.get('effective_duration', 0) for l in valid_s_laps) / s_time
                        def s_to_p(s): return 1000.0 / s / 60.0 if s and s > 0 else None
                        avg_intervals_pace = s_to_p(avg_speed)
                    
                    # Efficiency Calculation (Lap-based)
                    efficiencies = []
                    for l in work_laps:
                        # Get relevant signal average
                        # Note: Lap objects usually have 'avg_speed' in m/s
                        val = l.get('avg_power') if eff_signal_col == 'power' else l.get('avg_speed')
                        hr = l.get('avg_heart_rate')
                        
                        if val is not None and hr is not None and hr > 0:
                            efficiencies.append(val / hr)
                    
                    if efficiencies:
                        interval_pahr_mean = sum(efficiencies) / len(efficiencies)
                        interval_pahr_last = efficiencies[-1]

                    interval_blocks_summary = self._build_interval_blocks_summary_from_laps(work_laps, sport)
                    primary_block = self._pick_primary_interval_block(interval_blocks_summary)
                    if primary_block:
                        avg_intervals_power = primary_block.get("interval_power_mean")
                        avg_intervals_hr = primary_block.get("interval_hr_mean")
                        avg_intervals_pace = primary_block.get("interval_pace_mean")
                        last_interval_power = primary_block.get("interval_power_last")
                        last_interval_hr = primary_block.get("interval_hr_last")
                        last_interval_pace = primary_block.get("interval_pace_last")
                        interval_pahr_mean = primary_block.get("interval_pahr_mean")
                        interval_pahr_last = primary_block.get("interval_pahr_last")

        # 11. Smart Segmentation (Karoly's Request)
        # Determine strategy - Use activity name (title) for keyword detection
        strategy = self.classifier.get_strategy(meta.activity_name or "", nolio_type or "", nolio_comment or "", is_competition_nolio=is_competition_nolio)
        sport_cat = self._get_sport_category(meta.activity_type)
        seg_activity_type = meta.source_sport or meta.activity_type or sport_cat
        
        seg_output = SegmentationOutput(segmentation_type=strategy)
        
        if strategy == "manual":
            manual_config = self.classifier.parse_splits(nolio_comment)
            seg_output.manual = self.segmenter.manual_split(df, manual_config, seg_activity_type)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.manual)
        elif strategy == "auto_competition":
            # 2 phases AND 4 phases for competition
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, seg_activity_type, skip_first_seconds=600)
            seg_output.splits_4 = self.segmenter.auto_split(df, 4, seg_activity_type, skip_first_seconds=600)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.splits_2)
        else: # auto_training
            # Systematic 2 phases AND 4 phases for continuous training
            # (4 phases stored for future dashboard, 2 phases used for primary KPI)
            seg_output.splits_2 = self.segmenter.auto_split(df, 2, seg_activity_type, skip_first_seconds=600)
            seg_output.splits_4 = self.segmenter.auto_split(df, 4, seg_activity_type, skip_first_seconds=600)
            seg_output.drift_percent = self.segmenter.calculate_drift(seg_output.splits_2)

        # ========== FINAL CLEANUP FOR KAROLY (2026-02-01) ==========
        # Rule: Run Power is only reliable with Stryd (CP > 100).
        # If not (Garmin Wrist Power), we force to None to favor Pace display.
        if sport == "run" and not has_ref_power:
            avg_intervals_power = None
            last_interval_power = None

        # Rule: Bike intervals use power only, pace is irrelevant.
        if sport == "bike":
            avg_intervals_pace = None
            last_interval_pace = None

        return {
            "interval_power_last": round(float(last_interval_power), 1) if last_interval_power is not None else None,
            "interval_hr_last": round(float(last_interval_hr), 1) if last_interval_hr is not None else None,
            "interval_power_mean": round(float(avg_intervals_power), 1) if avg_intervals_power is not None else None,
            "interval_hr_mean": round(float(avg_intervals_hr), 1) if avg_intervals_hr is not None else None,
            "interval_pace_last": round(float(last_interval_pace), 2) if last_interval_pace is not None else None,
            "interval_pace_mean": round(float(avg_intervals_pace), 2) if avg_intervals_pace is not None else None,
            "interval_respect_score": round(float(global_respect_score), 1) if global_respect_score is not None else None,
            "interval_pahr_mean": round(float(interval_pahr_mean), 3) if interval_pahr_mean is not None else None,
            "interval_pahr_last": round(float(interval_pahr_last), 3) if interval_pahr_last is not None else None,
            "interval_blocks": interval_blocks_summary,
            "interval_detection_source": interval_detection_source,
            "energy_kj": round(energy_kj, 1) if energy_kj is not None else None,
            "intensity_factor": round(if_mean, 3),
            "mec": round(mec, 1) if mec is not None else None,
            "int_index": round(int_index, 3),
            "dur_index": round(dur_index, 3),
            "drift_pahr_percent": round(drift_pahr_pct, 2),
            "mls_load": round(mls_load, 1) if mls_load is not None else None,
            "normalized_power": round(np_val, 1),
            "tss": round(tss, 1),
            "segmented_metrics": seg_output,
            "intervals": detected_blocks
        }

    def _to_pace(self, speed_mps: Optional[float]) -> Optional[float]:
        if speed_mps is None or speed_mps <= 0:
            return None
        return 1000.0 / speed_mps / 60.0

    def _build_interval_blocks_summary_from_detections(
        self,
        detections: List[Dict[str, Any]],
        sport: str
    ) -> List[Dict[str, Any]]:
        normalized = []
        for idx, d in enumerate(detections):
            target = d.get("target") or {}
            normalized.append({
                "order": idx,
                "duration_sec": float(d.get("duration_sec") or 0),
                "target_duration": float(target.get("duration") or d.get("expected_duration") or 0),
                "target_distance": float(target.get("distance_m") or 0),
                "avg_power": d.get("avg_power"),
                "avg_speed": d.get("avg_speed"),
                "avg_hr": d.get("avg_hr"),
                "respect_score": d.get("respect_score")
            })
        return self._group_and_summarize_interval_entries(normalized, sport)

    def _build_interval_blocks_summary_from_laps(
        self,
        work_laps: List[Dict[str, Any]],
        sport: str
    ) -> List[Dict[str, Any]]:
        normalized = []
        for idx, lap in enumerate(work_laps):
            duration = float(lap.get("effective_duration") or lap.get("total_timer_time") or lap.get("total_elapsed_time") or 0)
            normalized.append({
                "order": idx,
                "duration_sec": duration,
                "target_duration": duration,
                "target_distance": float(lap.get("total_distance") or 0),
                "avg_power": lap.get("avg_power"),
                "avg_speed": lap.get("avg_speed"),
                "avg_hr": lap.get("avg_heart_rate"),
                "respect_score": None
            })
        return self._group_and_summarize_interval_entries(normalized, sport)

    def _group_and_summarize_interval_entries(
        self,
        entries: List[Dict[str, Any]],
        sport: str
    ) -> List[Dict[str, Any]]:
        if not entries:
            return []

        blocks: List[List[Dict[str, Any]]] = [[entries[0]]]
        for entry in entries[1:]:
            current_block = blocks[-1]
            prev = current_block[-1]

            prev_dist = float(prev.get("target_distance") or 0)
            curr_dist = float(entry.get("target_distance") or 0)
            prev_dur = float(prev.get("target_duration") or prev.get("duration_sec") or 0)
            curr_dur = float(entry.get("target_duration") or entry.get("duration_sec") or 0)

            same_block = False
            if prev_dist > 0 and curr_dist > 0:
                ratio = curr_dist / prev_dist if prev_dist > 0 else 0
                same_block = 0.75 <= ratio <= 1.35
            elif prev_dur > 0 and curr_dur > 0:
                ratio = curr_dur / prev_dur if prev_dur > 0 else 0
                same_block = 0.75 <= ratio <= 1.35

            if same_block:
                current_block.append(entry)
            else:
                blocks.append([entry])

        summaries = []
        for idx, block in enumerate(blocks, start=1):
            durations = [float(e.get("duration_sec") or 0) for e in block]
            total_duration = sum(durations)
            avg_speed_vals = [e.get("avg_speed") for e in block]
            avg_power_vals = [e.get("avg_power") for e in block]
            avg_hr_vals = [e.get("avg_hr") for e in block]
            respects = [e.get("respect_score") for e in block if e.get("respect_score") is not None]

            sum_speed = sum((e.get("avg_speed") or 0) * (e.get("duration_sec") or 0) for e in block if e.get("avg_speed") is not None)
            speed_time = sum((e.get("duration_sec") or 0) for e in block if e.get("avg_speed") is not None)
            mean_speed = (sum_speed / speed_time) if speed_time > 0 else None

            sum_power = sum((e.get("avg_power") or 0) * (e.get("duration_sec") or 0) for e in block if e.get("avg_power") is not None)
            power_time = sum((e.get("duration_sec") or 0) for e in block if e.get("avg_power") is not None)
            mean_power = (sum_power / power_time) if power_time > 0 else None

            sum_hr = sum((e.get("avg_hr") or 0) * (e.get("duration_sec") or 0) for e in block if e.get("avg_hr") is not None)
            hr_time = sum((e.get("duration_sec") or 0) for e in block if e.get("avg_hr") is not None)
            mean_hr = (sum_hr / hr_time) if hr_time > 0 else None

            last = block[-1]
            last_speed = last.get("avg_speed")
            last_power = last.get("avg_power")
            last_hr = last.get("avg_hr")

            efficiencies = []
            for e in block:
                val = e.get("avg_power") if sport == "bike" else e.get("avg_speed")
                hr = e.get("avg_hr")
                if val is not None and hr is not None and hr > 0:
                    efficiencies.append(val / hr)

            target_distances = [float(e.get("target_distance") or 0) for e in block if float(e.get("target_distance") or 0) > 0]
            representative_distance = target_distances[0] if target_distances else None
            target_durations = [float(e.get("target_duration") or 0) for e in block if float(e.get("target_duration") or 0) > 0]
            representative_duration = target_durations[0] if target_durations else (durations[0] if durations else None)

            summaries.append({
                "block_index": idx,
                "count": len(block),
                "total_duration_sec": round(total_duration, 1) if total_duration > 0 else None,
                "representative_distance_m": round(representative_distance, 1) if representative_distance else None,
                "representative_duration_sec": round(representative_duration, 1) if representative_duration else None,
                "interval_power_mean": round(float(mean_power), 1) if mean_power is not None else None,
                "interval_hr_mean": round(float(mean_hr), 1) if mean_hr is not None else None,
                "interval_pace_mean": round(float(self._to_pace(mean_speed)), 2) if mean_speed is not None and sport != "bike" else None,
                "interval_power_last": round(float(last_power), 1) if last_power is not None else None,
                "interval_hr_last": round(float(last_hr), 1) if last_hr is not None else None,
                "interval_pace_last": round(float(self._to_pace(last_speed)), 2) if last_speed is not None and sport != "bike" else None,
                "interval_pahr_mean": round(float(sum(efficiencies) / len(efficiencies)), 3) if efficiencies else None,
                "interval_pahr_last": round(float(efficiencies[-1]), 3) if efficiencies else None,
                "interval_respect_score_mean": round(float(sum(respects) / len(respects)), 1) if respects else None
            })

        return self._prune_noise_interval_blocks(summaries)

    def _prune_noise_interval_blocks(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove obvious edge noise blocks (e.g., a single transition lap before
        the true repeated set) while keeping meaningful multi-block sessions.
        """
        if len(blocks) <= 2:
            return blocks

        primary = self._pick_primary_interval_block(blocks)
        if not primary:
            return blocks

        primary_count = int(primary.get("count") or 0)
        primary_pace = primary.get("interval_pace_mean")
        primary_dist = float(primary.get("representative_distance_m") or 0)

        filtered: List[Dict[str, Any]] = []
        total = len(blocks)
        for idx, block in enumerate(blocks):
            is_edge = idx == 0 or idx == total - 1
            is_singleton = int(block.get("count") or 0) == 1

            drop_as_leading_transition = False
            if is_edge and is_singleton and idx == 0 and primary_count >= 3 and primary_pace and primary_dist > 0:
                blk_pace = block.get("interval_pace_mean")
                blk_dist = float(block.get("representative_distance_m") or 0)
                if blk_pace and blk_dist > 0:
                    dist_close = 0.9 * primary_dist <= blk_dist <= 1.8 * primary_dist
                    notably_slower = blk_pace > primary_pace * 1.12
                    drop_as_leading_transition = dist_close and notably_slower

            if not drop_as_leading_transition:
                filtered.append(block)

        if len(filtered) == len(blocks):
            return blocks

        for new_idx, block in enumerate(filtered, start=1):
            block["block_index"] = new_idx
        return filtered

    def _pick_primary_interval_block(self, blocks: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not blocks:
            return None
        return sorted(blocks, key=lambda b: (-int(b.get("count") or 0), int(b.get("block_index") or 9999)))[0]

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
