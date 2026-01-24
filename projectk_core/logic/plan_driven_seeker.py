
import numpy as np
import pandas as pd
from typing import Dict, Optional, Tuple

class PlanDrivenSeeker:
    """
    Surgically seeks for an interval of a specific duration informed by a plan.
    Uses cross-correlation (sliding window) + gradient refinement for sub-second precision.
    Supports multi-signal analysis (Power, Speed, Cadence).
    """
    
    def __init__(self, df: pd.DataFrame, primary_signal: str = 'power'):
        self.df = df
        self.primary_signal = primary_signal
        self.signal = np.nan_to_num(df[primary_signal].values)
        
    def seek(self, target_duration: int, expected_start: int, search_window: int = 60, min_start: Optional[int] = None, strict_duration: bool = False) -> Optional[Dict]:
        """
        Seeks for an interval of target_duration around expected_start.
        """
        if target_duration <= 0:
            return None
            
        # 1. Define search range
        search_start = max(0, expected_start - search_window)
        if min_start is not None:
            search_start = max(search_start, min_start)
            
        search_end = min(len(self.signal), expected_start + target_duration + search_window)
        
        if search_end - search_start < target_duration:
            return None
            
        # 2. Sliding Window on Primary Signal
        series = pd.Series(self.signal[search_start:search_end])
        rolling_mean = series.rolling(window=target_duration).mean()
        
        if rolling_mean.isnull().all():
            return None
            
        best_end_rel = rolling_mean.idxmax()
        if pd.isna(best_end_rel):
            return None
            
        best_start_rel = best_end_rel - target_duration + 1
        
        abs_start = int(search_start + best_start_rel)
        abs_end = int(search_start + best_end_rel + 1)
        
        # 3. Refinement using Gradients & Multi-Signal
        # In composite blocks (strict_duration=True), we only allow very minor adjustments (+/- 2s)
        # to avoid edge snapping onto the adjacent high-intensity block.
        refine_window = 5 if strict_duration else 15
        
        refined_start = self._refine_start(abs_start, window=refine_window)
        refined_end = self._refine_end(abs_end, window=refine_window)
        
        if strict_duration:
            # If strict, we only snap if the gradient is very close to the sliding window result
            if abs(refined_start - abs_start) <= 3:
                abs_start = int(refined_start)
            if abs(refined_end - abs_end) <= 3:
                abs_end = int(refined_end)
        else:
            abs_start = int(refined_start)
            abs_end = int(refined_end)

        # Recalculate metrics
        avg_val = np.mean(self.signal[abs_start:abs_end])
        
        return {
            'start': abs_start,
            'end': abs_end,
            'duration': abs_end - abs_start,
            'avg': float(avg_val)
        }
        
    def _refine_start(self, idx: int, window: int = 15) -> int:
        """Find the sharpest combined rise around idx."""
        search_min = max(0, idx - window)
        search_max = min(len(self.signal), idx + window)
        
        # Combine gradients of primary signal and cadence if available
        grad_primary = np.diff(self.signal[search_min:search_max])
        
        # Normalize gradients for combination
        norm_grad = grad_primary / (np.max(np.abs(grad_primary)) + 1e-6)
        
        if 'cadence' in self.df.columns:
            cadence = self.df['cadence'].values[search_min:search_max]
            grad_cadence = np.diff(cadence)
            norm_grad += grad_cadence / (np.max(np.abs(grad_cadence)) + 1e-6)
            
        best_grad_idx = np.argmax(norm_grad)
        return search_min + int(best_grad_idx) + 1

    def _refine_end(self, idx: int, window: int = 15) -> int:
        """Find the sharpest combined drop around idx."""
        search_min = max(0, idx - window)
        search_max = min(len(self.signal), idx + window)
        
        grad_primary = np.diff(self.signal[search_min:search_max])
        norm_grad = grad_primary / (np.max(np.abs(grad_primary)) + 1e-6)
        
        if 'cadence' in self.df.columns:
            cadence = self.df['cadence'].values[search_min:search_max]
            grad_cadence = np.diff(cadence)
            norm_grad += grad_cadence / (np.max(np.abs(grad_cadence)) + 1e-6)
            
        best_grad_idx = np.argmin(norm_grad)
        return search_min + int(best_grad_idx) + 1
