import pandas as pd
import numpy as np
from scipy.signal import find_peaks
from typing import List, Dict, Optional, Tuple
from projectk_core.logic.models import Activity

class IntervalDetector:
    """
    Detects intervals in an activity based on a planned structure.
    Implements Karoly's logic: Rolling Max -> Peak Detection -> Overlap Removal -> Selection.
    """

    @staticmethod
    def detect(activity: Activity, plan: Optional[Dict] = None) -> Dict[str, float]:
        """
        Detects intervals. If plan is provided, uses it. 
        If no plan, uses 'Autostruct' logic to find the most likely interval pattern.
        """
        if activity.empty:
            return {}

        df = activity.streams
        
        # Select signal
        if 'power' in df.columns and df['power'].max() > 100:
            signal_col = 'power'
        elif 'speed' in df.columns and df['speed'].max() > 2.0: # > 7.2km/h
            signal_col = 'speed'
        else:
            return {} 

        # --- STRATEGY 1: GUIDED (Plan Provided) ---
        if plan:
            # Check feasibility
            if plan.get('duration', 0) > len(df):
                return {}

            # Normalize sport
            sport = "run"
            raw_sport = getattr(activity.metadata, 'sport_type', 'run').lower() if activity.metadata else 'run'
            if 'bike' in raw_sport or 'cycl' in raw_sport: sport = 'bike'
            elif 'swim' in raw_sport or 'nat' in raw_sport: sport = 'swim'

            # Prepare Plan with Estimated Intensity
            target_grid = plan
            if isinstance(plan, dict) and 'duration' in plan:
                # Heuristic: Set target_min to 75% of Session Max (stricter)
                t_min = 0
                if signal_col == 'power':
                    max_val = df['power'].quantile(0.95)
                    t_min = max_val * 0.75
                elif signal_col == 'speed':
                    max_val = df['speed'].quantile(0.95)
                    t_min = max_val * 0.75
                    
                target_grid = [{"duration": plan['duration'], "type": "active", "target_min": t_min}] * plan.get('reps', 1)
            
            # Use Matcher V3
            from projectk_core.processing.interval_matcher import IntervalMatcher
            matcher = IntervalMatcher()
            
            laps = activity.laps if hasattr(activity, 'laps') else None
            
            results = matcher.match(df, target_grid, sport=sport, laps=laps)
            return IntervalDetector._adapt_output(results)

        # --- STRATEGY 2: BLIND AUTOSTRUCT ---
        # Test common interval durations to find the best fit
        candidates_durations = [30, 60, 180, 300, 600, 900, 1200] # 30s to 20min
        best_result = {}
        best_score = 0

        for dur in candidates_durations:
            # We assume at least 2 reps for an interval session
            res = IntervalDetector._detect_fixed(df, signal_col, dur, min_reps=2)
            if not res: 
                continue
            
            # Score = Total Work (Power * Duration * Reps) * Regularity
            # We want to favor identifying the "main set"
            reps_found = len(res.get('blocks', []))
            if reps_found < 2: continue
            
            avg_p = res['interval_power_mean']
            score = avg_p * dur * reps_found
            
            if score > best_score:
                best_score = score
                best_result = res
        
        return best_result

    @staticmethod
    def _detect_fixed(df: pd.DataFrame, signal_col: str, duration_sec: int, min_reps: int = 1) -> Dict:
        """
        Core detection logic for a fixed duration.
        """
        window_size = int(duration_sec)
        if len(df) < window_size: return {}

        signal_series = df[signal_col].fillna(0)
        rolling_signal = signal_series.rolling(window=window_size).mean()
        
        # Threshold: Significant effort relative to session max
        # For long intervals (15'), threshold is lower than for sprints (30")
        # Optimization: Cap the max_val to avoid sprints skewing the threshold for endurance blocks
        max_val = rolling_signal.quantile(0.95) # Use 95th percentile instead of absolute max
        if max_val == 0: return {}
        
        # Lower threshold to capture the full block (warmup/fatigue included)
        threshold_ratio = 0.55 if duration_sec > 600 else 0.70
        height_threshold = max_val * threshold_ratio
        
        peaks, properties = find_peaks(rolling_signal.fillna(0).values, height=height_threshold, distance=int(window_size * 1.1))
        
        if len(peaks) < min_reps:
            return {}

        # Select all valid peaks found (we don't limit to 'reps' in blind mode usually, but sort by quality)
        peak_values = properties['peak_heights']
        candidates = sorted(list(zip(peaks, peak_values)), key=lambda x: x[1], reverse=True)
        
        # In guided mode we might limit, here we take top N matches if reps specified?
        # Actually, let's take all peaks that look like the main set (within 25% of best peak now, more permissive)
        best_peak = candidates[0][1]
        selected = [c for c in candidates if c[1] >= best_peak * 0.75]
        
        if len(selected) < min_reps:
            return {}

        selected.sort(key=lambda x: x[0]) # Chronological
        
        # Merge contiguous blocks (e.g., 5x3min -> 1x15min)
        # Dynamic gap tolerance: for short intervals, we don't want to merge them if there's a rest.
        # If window is < 5min, use 45s tolerance. Otherwise use 180s.
        gap_tol = 45 if duration_sec < 300 else 180
        merged_intervals = IntervalDetector._merge_intervals(selected, window_size, df, signal_col, gap_tolerance=gap_tol)
        
        # Compute Metrics on Merged Intervals
        details = []
        sum_p = 0
        sum_hr = 0
        
        for start_idx, end_idx, avg_val in merged_intervals:
            dur = end_idx - start_idx
            
            # Re-compute averages on the full merged segment
            p = df['power'].iloc[start_idx:end_idx].mean() if 'power' in df.columns else 0.0
            hr = df['heart_rate'].iloc[start_idx:end_idx].mean() if 'heart_rate' in df.columns else 0.0
            
            sum_p += p
            sum_hr += hr
            
            details.append({
                "index": start_idx, # Start index
                "timestamp": str(df['timestamp'].iloc[start_idx]) if 'timestamp' in df.columns else str(start_idx),
                "avg_power": round(float(p), 1),
                "avg_hr": round(float(hr), 1),
                "duration_sec": int(dur)
            })
            
        if not details: return {}

        return {
            "interval_power_last": round(float(details[-1]["avg_power"]), 1),
            "interval_hr_last": round(float(details[-1]["avg_hr"]), 1),
            "interval_power_mean": round(float(sum_p / len(details)), 1),
            "interval_hr_mean": round(float(sum_hr / len(details)), 1),
            "blocks": details
        }

    @staticmethod
    def _adapt_output(matched_intervals: List[Dict]) -> Dict:
        if not matched_intervals:
            return {}
            
        blocks = []
        sum_p = 0
        sum_hr = 0
        count_p = 0
        count_hr = 0
        
        for m in matched_intervals:
            if m['status'] != 'matched':
                continue
                
            p = m.get('plateau_avg_power') or m.get('avg_power') or 0
            hr = m.get('avg_hr') or 0
            
            blocks.append({
                "index": m['start_index'],
                "duration_sec": m['duration_sec'],
                "avg_power": round(float(p), 1),
                "avg_hr": round(float(hr), 1),
                "timestamp": str(m.get('start_index')),
                "source": m.get('source')
            })
            
            if p > 0: 
                sum_p += p
                count_p += 1
            if hr > 0:
                sum_hr += hr
                count_hr += 1
            
        if not blocks:
            return {}
            
        avg_p = sum_p / count_p if count_p > 0 else 0
        avg_hr = sum_hr / count_hr if count_hr > 0 else 0
        
        return {
            "interval_power_mean": round(avg_p, 1),
            "interval_hr_mean": round(avg_hr, 1),
            "interval_power_last": round(blocks[-1]['avg_power'], 1),
            "interval_hr_last": round(blocks[-1]['avg_hr'], 1),
            "blocks": blocks,
            "detailed_matches": matched_intervals
        }

    @staticmethod
    def _merge_intervals(candidates: List[Tuple], base_duration: int, df: pd.DataFrame, signal_col: str, gap_tolerance: int = 60) -> List[Tuple[int, int, float]]:
        """
        Merges blocks that are close in time.
        Returns list of (start_idx, end_idx, avg_value).
        """
        if not candidates: return []
        
        # Convert peaks (center) to ranges (start, end)
        # Peak index is the END of the rolling window usually, or center depending on implementation.
        # pandas rolling mean puts value at the index. So if window=180, val at 180 is avg(0-180).
        # So Start = Index - Window + 1, End = Index + 1
        
        ranges = []
        for idx, val in candidates:
            start = max(0, int(idx - base_duration + 1))
            end = int(idx + 1)
            ranges.append((start, end, val))
            
        merged = []
        if not ranges: return []
        
        # Sort by start time
        ranges.sort(key=lambda x: x[0])
        
        curr_start, curr_end, _ = ranges[0]
        
        for i in range(1, len(ranges)):
            next_start, next_end, _ = ranges[i]
            
            # Gap between current end and next start
            gap = next_start - curr_end
            
            # Merge if overlap or gap is small (< gap_tolerance) 
            # AND if the blocks are conceptually "glued" (gap is not a recovery)
            if gap < gap_tolerance: 
                # Extend the current block
                curr_end = max(curr_end, next_end)
            else:
                # Push current and start new
                merged.append((curr_start, curr_end, 0.0)) # We'll recalc val later
                curr_start = next_start
                curr_end = next_end
                
        merged.append((curr_start, curr_end, 0.0))
        return merged
