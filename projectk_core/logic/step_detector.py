
import numpy as np
import pandas as pd
from scipy.signal import savgol_filter
from typing import List, Dict, Any, Tuple, Optional

class StepDetector:
    """
    Detects abrupt changes (steps) in time-series signals (Power, Speed).
    Ideal for finding interval boundaries without relying on fixed thresholds.
    """

    def __init__(self, window_size: int = 30, threshold_factor: float = 1.0, min_delta: float = 5.0):
        """
        Args:
            window_size: Size of the sliding windows to compare (in seconds).
            threshold_factor: Sensitivity. Lower = more steps detected.
            min_delta: Minimum change in mean to be considered a step (e.g., 5W or 0.2m/s).
        """
        self.window_size = window_size
        self.threshold_factor = threshold_factor
        self.min_delta = min_delta

    def detect_steps(self, signal: np.ndarray) -> List[int]:
        """
        Identifies indices where the signal mean shifts significantly.
        """
        if len(signal) < self.window_size * 2:
            return []

        # 1. Smooth signal
        smooth_signal = savgol_filter(signal, min(len(signal), 61) if len(signal) > 61 else 11, 2)
        
        # 2. Calculate Mean Difference
        shifts = np.zeros(len(smooth_signal))
        w = self.window_size
        
        for i in range(w, len(smooth_signal) - w):
            prev_mean = np.mean(smooth_signal[i-w:i])
            next_mean = np.mean(smooth_signal[i:i+w])
            shifts[i] = next_mean - prev_mean
            
        # 3. Detect Peaks
        abs_shifts = np.abs(shifts)
        
        mean_abs = np.mean(abs_shifts)
        std_abs = np.std(abs_shifts)
        
        # Threshold: 
        # Ideally, we want to detect shifts that are statistically significant OR physically significant
        # If the session is very interval-heavy, std_abs will be huge, making the threshold too high.
        # So we should clamp the statistical threshold or use min_delta as a strong alternative.
        
        stat_threshold = mean_abs + self.threshold_factor * std_abs
        
        # If statistical threshold is crazy high (e.g. > 3*min_delta), ignore it and trust min_delta
        if stat_threshold > 3 * self.min_delta:
            threshold = max(self.min_delta, mean_abs) # Fallback to mean
        else:
            threshold = max(self.min_delta, stat_threshold)
        
        steps = []
        i = w
        while i < len(abs_shifts) - w:
            if abs_shifts[i] > threshold:
                search_end = min(i + w, len(abs_shifts))
                local_max_idx = i + np.argmax(abs_shifts[i : search_end])
                steps.append(local_max_idx)
                i = local_max_idx + w
            else:
                i += 1
                
        return steps

    def segment_by_steps(self, signal: np.ndarray, steps: List[int]) -> List[Dict[str, Any]]:
        """
        Divides the signal into segments based on detected steps.
        """
        segments = []
        indices = [0] + steps + [len(signal)]
        
        for i in range(len(indices) - 1):
            start = indices[i]
            end = indices[i+1]
            if end - start < 5: # Skip tiny segments
                continue
                
            seg_data = signal[start:end]
            segments.append({
                "start": start,
                "end": end,
                "duration": end - start,
                "mean": np.mean(seg_data),
                "std": np.std(seg_data)
            })
            
        return segments
