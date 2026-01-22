
import numpy as np
import pandas as pd
from scipy.signal import savgol_filter
from typing import List, Dict, Any, Tuple, Optional

class StepDetector:
    """
    Detects abrupt changes (steps) in time-series signals (Power, Speed).
    Ideal for finding interval boundaries without relying on fixed thresholds.
    """

    def __init__(self, window_size: int = 15, threshold_factor: float = 2.0):
        """
        Args:
            window_size: Size of the sliding windows to compare (in seconds).
            threshold_factor: Sensitivity. Higher = fewer steps detected.
        """
        self.window_size = window_size
        self.threshold_factor = threshold_factor

    def detect_steps(self, signal: np.ndarray) -> List[int]:
        """
        Identifies indices where the signal mean shifts significantly.
        
        Returns:
            List of indices corresponding to detected steps.
        """
        if len(signal) < self.window_size * 2:
            return []

        # 1. Smooth signal to remove high-frequency noise
        # We use a relatively small window for Savitzky-Golay to keep transitions sharp
        smooth_signal = savgol_filter(signal, min(len(signal), 11), 2)
        
        # 2. Calculate Mean Difference between two adjacent windows
        # diff[i] = mean(signal[i:i+W]) - mean(signal[i-W:i])
        shifts = np.zeros(len(smooth_signal))
        w = self.window_size
        
        for i in range(w, len(smooth_signal) - w):
            prev_mean = np.mean(smooth_signal[i-w:i])
            next_mean = np.mean(smooth_signal[i:i+w])
            shifts[i] = next_mean - prev_mean
            
        # 3. Detect Peaks in the absolute shift
        abs_shifts = np.abs(shifts)
        std_shift = np.std(abs_shifts)
        mean_shift = np.mean(abs_shifts)
        
        # Threshold for a "significant" step
        threshold = mean_shift + self.threshold_factor * std_shift
        
        steps = []
        i = w
        while i < len(abs_shifts) - w:
            if abs_shifts[i] > threshold:
                # Find local maximum in a small neighborhood to get precise transition point
                search_range = abs_shifts[i : i + 10]
                local_max_idx = i + np.argmax(search_range)
                steps.append(local_max_idx)
                # Skip some points to avoid multiple detections for the same step
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
