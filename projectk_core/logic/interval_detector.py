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
    def detect(activity: Activity, plan: Dict) -> Dict[str, float]:
        """
        Detects intervals matching the plan and computes aggregate metrics.
        
        Args:
            activity: The Activity object with streams.
            plan: A dictionary describing the main interval set.
                  Example: {"type": "time", "duration": 180, "reps": 6} 
                  (6 reps of 3 minutes)
        
        Returns:
            Dict containing the 4 key metrics:
            - interval_power_last
            - interval_hr_last
            - interval_power_mean
            - interval_hr_mean
            
            Returns empty dict if detection fails or is impossible.
        """
        if activity.empty or not plan:
            return {}

        df = activity.streams
        
        # Select signal for detection (Power preferred, then Speed)
        if 'power' in df.columns and df['power'].max() > 10:
            signal_col = 'power'
        elif 'speed' in df.columns and df['speed'].max() > 0.5:
            signal_col = 'speed'
        else:
            return {} # No valid signal for interval detection

        # 1. Parse Plan
        target_type = plan.get('type', 'time').lower()
        duration_sec = plan.get('duration')
        reps = plan.get('reps', 1)

        # For now, we only support TIME based intervals
        if target_type != 'time' or not duration_sec or duration_sec <= 0:
            return {}

        # 2. Rolling Average
        window_size = int(duration_sec)
        signal_series = df[signal_col].fillna(0)
        rolling_signal = signal_series.rolling(window=window_size).mean()
        
        # 3. Peak Detection
        clean_rolling = rolling_signal.fillna(0).values
        max_val = np.max(clean_rolling)
        height_threshold = max_val * 0.5
        
        peaks, properties = find_peaks(clean_rolling, height=height_threshold, distance=int(window_size * 0.5))
        
        if len(peaks) == 0:
            return {}

        # 4. Filter & Select Top N
        peak_values = properties['peak_heights']
        candidates = list(zip(peaks, peak_values))
        candidates.sort(key=lambda x: x[1], reverse=True)
        selected = candidates[:reps]
        
        if not selected:
            return {}
            
        # 5. Chronological Sort
        selected.sort(key=lambda x: x[0])
        
        # 6. Compute Metrics
        count = len(selected)
        last_idx, last_val = selected[-1]
        
        def get_interval_avg(end_idx, dur, col):
            if col not in df.columns: return 0.0
            s, e = int(end_idx - dur + 1), int(end_idx + 1)
            segment = df[col].iloc[s:e]
            return segment.mean() if not segment.empty else 0.0

        last_p = last_val if signal_col == 'power' else get_interval_avg(last_idx, window_size, 'power')
        last_hr = get_interval_avg(last_idx, window_size, 'heart_rate')

        sum_p = 0
        sum_hr = 0
        for idx, val in selected:
            sum_p += val if signal_col == 'power' else get_interval_avg(idx, window_size, 'power')
            sum_hr += get_interval_avg(idx, window_size, 'heart_rate')
            
        return {
            "interval_power_last": round(float(last_p), 1),
            "interval_hr_last": round(float(last_hr), 1),
            "interval_power_mean": round(float(sum_p / count), 1),
            "interval_hr_mean": round(float(sum_hr / count), 1)
        }
