
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
        
        for target in target_grid:
            duration_s = int(target.get('duration', 0))
            if duration_s <= 0 or duration_s > len(temp_signal):
                continue
                
            # Rolling Mean for this duration
            # Using pandas rolling is cleaner but numpy convolution is faster.
            # Let's use pandas on the series copy.
            
            # We need to re-create series from masked signal to handle gaps?
            # No, if we mask with 0, the mean will drop, which is what we want (don't pick masked areas).
            
            rolling = pd.Series(temp_signal).rolling(window=duration_s).mean()
            
            # Find max
            max_idx = rolling.idxmax() # Index of the END of the window
            max_val = rolling.max()
            
            # Threshold Check: Is this a "real" interval?
            # 1. Absolute minimal threshold
            if sport == 'bike':
                abs_threshold = 50 
            elif sport == 'swim':
                abs_threshold = 0.5 # 0.5 m/s = 3:20/100m (Very slow but active)
            else: # Run
                abs_threshold = 1.5 # 1.5 m/s = 5.4 km/h
                
            if pd.isna(max_val) or max_val < abs_threshold:
                # print(f"DEBUG: Rejected Abs. Val={max_val} < {abs_threshold}")
                continue

            # 2. Target-relative check (Did they even try?)
            # If we have a target_min, found value should be at least X% of it.
            # Let's say 60% to allow for bonking but filter out rest (usually < 50% of FTP).
            # RELAXATION: For long intervals (> 10min), use 40% threshold to catch endurance blocks.
            target_min = float(target.get('target_min', 0) or 0)
            threshold_ratio = 0.40 if duration_s > 600 else 0.60
            
            if target_min > 0:
                if max_val < (threshold_ratio * target_min):
                    # print(f"DEBUG: Rejected Relative. Val={max_val:.1f} < {threshold_ratio}*{target_min} ({threshold_ratio*target_min:.1f})")
                    continue
            
            # 3. If no target, compare to global max? (Optional, maybe later)
                
            start_idx = int(max_idx - duration_s + 1)
            end_idx = int(max_idx + 1)
            
            avg_power = float(df['power'].iloc[start_idx:end_idx].mean()) if 'power' in df.columns else None
            avg_speed = float(df['speed'].iloc[start_idx:end_idx].mean()) if 'speed' in df.columns else None
            avg_hr = float(df['heart_rate'].iloc[start_idx:end_idx].mean()) if 'heart_rate' in df.columns else None
            
            # Calculate Respect Score
            respect_score = None
            target_min = float(target.get('target_min', 0) or 0)
            target_max = float(target.get('target_max', 0) or 0)
            
            # Prefer target_min as baseline for respect, or mid-range?
            # Karoly usually gives a range. Let's use target_min as the "floor" for 100%? 
            # Or better: realized / target_min * 100.
            # If he gives "300-320W", and athlete does 300W -> 100%. 270W -> 90%.
            
            if target_min > 0:
                realized = avg_power if sport == 'bike' else avg_speed
                if realized is not None:
                    respect_score = (realized / target_min) * 100.0

            # Store Detection
            detection = {
                "start_index": start_idx,
                "end_index": end_idx,
                "duration_sec": duration_s,
                "avg_power": avg_power,
                "avg_speed": avg_speed,
                "avg_hr": avg_hr,
                "respect_score": respect_score,
                "target": target
            }
            detected_intervals.append(detection)
            
            # Mask this area in temp_signal to prevent overlap
            # We mask with -1 or 0.
            temp_signal[start_idx:end_idx] = 0.0
            
        # 3. Sort by time to restore chronological order
        detected_intervals.sort(key=lambda x: x['start_index'])
        
        return detected_intervals
