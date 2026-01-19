import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

class IntervalMatcher:
    """
    Surgically aligns planned intervals (Target Grid) with actual data streams.
    Uses a sequential local-maximum search to maintain chronological integrity.
    """

    def match(self, df: pd.DataFrame, target_grid: List[Dict[str, Any]], sport: str = "bike") -> List[Dict[str, Any]]:
        """
        Matches target intervals to data.
        Returns a list of detected interval metrics.
        """
        if df.empty or not target_grid:
            return []

        # 1. Select Signal Source Strategy
        target_types = [t.get('target_type', '') for t in target_grid]
        pace_count = target_types.count('pace') + target_types.count('speed')
        power_count = target_types.count('power')
        
        signal_col = 'power' if sport == 'bike' else 'speed'
        if sport == 'run' and pace_count > power_count and 'speed' in df.columns:
            signal_col = 'speed'
        elif power_count > pace_count and 'power' in df.columns:
            signal_col = 'power'
            
        if signal_col not in df.columns:
            signal_col = 'speed' if 'speed' in df.columns else 'power'
            if signal_col not in df.columns: return []
            
        signal = df[signal_col].fillna(0).values.copy()
        detected_intervals = []
        current_ptr = 0
        
        for target in target_grid:
            duration_s = int(target.get('duration', 0))
            if duration_s <= 0: continue
                
            # 1. Search Signal from current position
            search_signal = signal[current_ptr:]
            if len(search_signal) < duration_s: break
            
            rolling = pd.Series(search_signal).rolling(window=duration_s).mean()
            
            # 2. Thresholds
            target_min = float(target.get('target_min', 0) or 0)
            target_type = target.get('type', 'active')
            
            # Strictness: 85% for all work steps (active/ramp_up)
            # Long blocks (>10min) are more flexible (endurance)
            if duration_s > 600:
                threshold_ratio = 0.40
            else:
                threshold_ratio = 0.85 # High bar to avoid warmup/recovery
                
            abs_thresh = 50 if sport == 'bike' else (0.5 if sport == 'swim' else 1.5)
            min_required = max(abs_thresh, threshold_ratio * target_min)
            
            # 3. Find first crossing
            valid_mask = rolling >= min_required
            if not valid_mask.any():
                continue 
                
            first_crossing_idx = valid_mask.idxmax()
            
            # 4. REFINEMENT: Find local max near the first crossing
            # We look ahead only half the duration to avoid catching the next rep
            # but enough to center the current one.
            look_ahead = min(duration_s, 120) 
            peak_zone = rolling.loc[first_crossing_idx : first_crossing_idx + look_ahead]
            
            best_idx_in_zone = peak_zone.idxmax()
            max_val = peak_zone.max()
            
            # 5. Extraction
            abs_max_idx = int(current_ptr + best_idx_in_zone)
            start_idx = int(abs_max_idx - duration_s + 1)
            end_idx = int(abs_max_idx + 1)
            
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
            
            # 6. Advance pointer
            # We must skip at least the duration of what we found
            current_ptr = end_idx + 5
                
        detected_intervals.sort(key=lambda x: x['start_index'])
        return detected_intervals