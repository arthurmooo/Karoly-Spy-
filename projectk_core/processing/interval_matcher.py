
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
        
        temp_signal = signal.copy()
        current_ptr = 0
        
        for target in target_grid:
            duration_s = int(target.get('duration', 0))
            if duration_s <= 0:
                continue
                
            # 1. Look at everything from current_ptr to end
            search_signal = temp_signal[current_ptr:]
            if len(search_signal) < duration_s: break
            
            rolling = pd.Series(search_signal).rolling(window=duration_s).mean()
            
            # 2. Identify the threshold
            target_min = float(target.get('target_min', 0) or 0)
            target_type = target.get('type', 'active')
            
            # STRICTER THRESHOLDS
            # For 'active' reps, we expect at least 90% of target.
            if target_type == 'active':
                threshold_ratio = 0.90
            else:
                threshold_ratio = 0.60
                
            # Long blocks (>10min) are usually endurance, 40% is enough.
            if duration_s > 600:
                threshold_ratio = 0.40
                
            abs_thresh = 50 if sport == 'bike' else (0.5 if sport == 'swim' else 1.5)
            min_required = max(abs_thresh, threshold_ratio * target_min)
            
            # 3. Find the first time we cross the threshold
            valid_mask = rolling >= min_required
            if not valid_mask.any():
                continue 
                
            first_crossing_idx = valid_mask.idxmax()
            
            # 4. REFINEMENT: Don't take the first one, take the BEST in the next few minutes
            # This ensures we get the 5.3 m/s plateau rather than the 4.5 m/s climb.
            # Window: we look up to 5 minutes after the first crossing or until signal drops.
            refinement_window = 300 
            peak_zone = rolling.loc[first_crossing_idx : first_crossing_idx + refinement_window]
            
            best_idx_in_zone = peak_zone.idxmax()
            max_val = peak_zone.max()
            
            # Absolute Index
            abs_max_idx = int(current_ptr + best_idx_in_zone)
            start_idx = int(abs_max_idx - duration_s + 1)
            end_idx = int(abs_max_idx + 1)
            
            # Metrics
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
            
            # 5. Move pointer forward
            current_ptr = end_idx + 5
                
        detected_intervals.sort(key=lambda x: x['start_index'])
                
        detected_intervals.sort(key=lambda x: x['start_index'])
        
        return detected_intervals
