
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

class IntervalMatcher:
    """
    Surgically aligns planned intervals (Target Grid) with actual data streams.
    Uses a greedy strict-window sliding approach.
    """

    def match(self, df: pd.DataFrame, target_grid: List[Dict[str, Any]], sport: str = "bike") -> List[Dict[str, Any]]:
        """
        Matches target intervals to data.
        Returns a list of detected interval metrics.
        """
        if df.empty or not target_grid:
            return []

        # 1. Select Signal Source Strategy
        # Check dominance in target_grid to align signal with plan
        target_types = [t.get('target_type', '') for t in target_grid]
        pace_count = target_types.count('pace') + target_types.count('speed')
        power_count = target_types.count('power')
        
        # Default logic
        signal_col = 'power' if sport == 'bike' else 'speed'
        
        # Override if strong mismatch (e.g. Running with Power meter but Plan is Pace-based)
        if sport == 'run' and pace_count > power_count and 'speed' in df.columns:
            signal_col = 'speed'
        elif power_count > pace_count and 'power' in df.columns:
            signal_col = 'power'
            
        if signal_col not in df.columns:
            # Fallback
            signal_col = 'speed' if 'speed' in df.columns else 'power'
            if signal_col not in df.columns:
                return []
            
        signal = df[signal_col].fillna(0).values.copy() # Copy to allow masking
        time_index = df.index if not df.empty else range(len(df))
        
        detected_intervals = []
        
        # 2. Iterate through targets (Greedy approach)
        # Note: This simple greedy approach might fail if a later interval is much harder than an earlier one 
        # and "steals" its spot. But for standard reps, it works. 
        # A more robust way for mixed intervals is finding ALL candidates and then sorting/filtering.
        
        # We process targets from largest/hardest to smallest? Or just sequential?
        # Let's try sequential searching but masking found areas.
        
        # Actually, for 10x30/30, they are identical.
        # We can just look for N non-overlapping peaks of duration D.
        
        # To avoid "stealing", we should probably respect the order roughly? 
        # But athletes might skip one.
        # Let's implement: Find best match for EACH target, mask it, then re-sort by start_time.
        
        # Optimization: Pre-calculate rolling means? No, durations vary.
        
        temp_signal = signal.copy()
        current_ptr = 0
        
        for target in target_grid:
            duration_s = int(target.get('duration', 0))
            if duration_s <= 0:
                continue
                
            # FIRST-FIT SEQUENTIAL STRATEGY
            # We search for the FIRST occurrence that satisfies the threshold
            # starting from the current pointer.
            
            target_min = float(target.get('target_min', 0) or 0)
            threshold_ratio = 0.40 if duration_s > 600 else 0.60
            abs_thresh = 50 if sport == 'bike' else (0.5 if sport == 'swim' else 1.5)
            
            search_signal = temp_signal[current_ptr:]
            if len(search_signal) < duration_s: break
            
            rolling = pd.Series(search_signal).rolling(window=duration_s).mean()
            
            # Find all indices where rolling mean satisfies threshold
            # We want the FIRST one.
            # Criterion: (Avg >= AbsThresh) AND (Avg >= Ratio * TargetMin)
            min_required = max(abs_thresh, threshold_ratio * target_min)
            
            # Vectorized find first
            valid_indices = rolling[rolling >= min_required].index
            
            if not valid_indices.empty:
                # We take the first valid index (END of window)
                abs_max_idx = int(current_ptr + valid_indices[0])
                start_idx = int(abs_max_idx - duration_s + 1)
                end_idx = int(abs_max_idx + 1)
                
                # Check if we didn't just pick a noisy spike (optional: could find local peak)
                # But First-Fit is already a huge step for chronology.
                
                avg_p = float(df['power'].iloc[start_idx:end_idx].mean()) if 'power' in df.columns else None
                avg_s = float(df['speed'].iloc[start_idx:end_idx].mean()) if 'speed' in df.columns else None
                avg_h = float(df['heart_rate'].iloc[start_idx:end_idx].mean()) if 'heart_rate' in df.columns else None
                
                respect = None
                if target_min > 0:
                    realized = avg_p if signal_col == 'power' else avg_s
                    if realized: respect = (realized / target_min) * 100.0

                detected_intervals.append({
                    "start_index": start_idx,
                    "end_index": end_idx,
                    "duration_sec": duration_s,
                    "avg_power": avg_p,
                    "avg_speed": avg_s,
                    "avg_hr": avg_h,
                    "respect_score": respect,
                    "target": target
                })
                
                current_ptr = end_idx + 5 # Small gap
            else:
                # No match found for this target in the rest of the session.
                # Skip it.
                pass
                
        detected_intervals.sort(key=lambda x: x['start_index'])
        
        return detected_intervals
