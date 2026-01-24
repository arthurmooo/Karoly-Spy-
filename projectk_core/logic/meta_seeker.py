
import numpy as np
import pandas as pd
from typing import Dict, Optional, Tuple
from scipy.interpolate import CubicSpline
from .plan_driven_seeker import PlanDrivenSeeker

class MetaSeeker(PlanDrivenSeeker):
    """
    Sub-second precision seeker using Spline Interpolation and Multi-Signal Physics.
    """
    
    def __init__(self, df: pd.DataFrame, primary_signal: str = 'power', resolution_hz: int = 10):
        super().__init__(df, primary_signal)
        self.resolution_hz = resolution_hz
        self.dt = 1.0 / resolution_hz
        # Matrice de latence par flux (en secondes)
        # On compense le fait que certains capteurs envoient la data avec un retard physique.
        self.lags = {
            'power': 0.5,
            'heart_rate': 2.0,
            'speed': 1.0,
            'cadence': 0.2
        }

    def _get_interpolated_window(self, start_idx: int, end_idx: int) -> Tuple[np.ndarray, np.ndarray]:
        """Returns interpolated time and signal for a window."""
        # Ensure indices are within bounds
        start_idx = int(max(0, start_idx))
        end_idx = int(min(len(self.signal), end_idx))
        
        if end_idx <= start_idx + 1:
            return np.array([0.0]), np.array([self.signal[start_idx]])
            
        y = self.signal[start_idx:end_idx]
        x = np.arange(len(y))
        
        cs = CubicSpline(x, y)
        
        # x_new with high resolution
        x_new = np.arange(0, len(y) - 1, self.dt)
        y_new = cs(x_new)
        
        return x_new, y_new

    def _refine_start(self, idx: int, window: int = 15) -> float:
        """Find the sharpest combined rise around idx with sub-second precision and lag compensation."""
        search_min = int(max(0, idx - window))
        search_max = int(min(len(self.signal), idx + window))
        
        x_fine, y_fine = self._get_interpolated_window(search_min, search_max)
        if len(y_fine) < 2:
            return float(idx)
            
        grad_primary = np.diff(y_fine)
        # On décale le gradient primaire par son lag propre (pour le remettre au temps 'réel')
        # Si on a 0.5s de lag, le T0 réel est 0.5s AVANT ce qu'on voit.
        primary_lag = self.lags.get(self.primary_signal, 0.0)
        
        norm_grad = grad_primary / (np.max(np.abs(grad_primary)) + 1e-6)
        
        # Multi-signal support (Cadence)
        if 'cadence' in self.df.columns:
            cad_y = np.nan_to_num(self.df['cadence'].values[search_min:search_max])
            if len(cad_y) >= 2:
                cad_cs = CubicSpline(np.arange(len(cad_y)), cad_y)
                cad_fine = cad_cs(x_fine)
                grad_cadence = np.diff(cad_fine)
                norm_grad += grad_cadence / (np.max(np.abs(grad_cadence)) + 1e-6)
        
        best_grad_idx = np.argmax(norm_grad)
        # Convert relative fine index back to absolute time
        abs_start_observed = search_min + (best_grad_idx + 1) * self.dt
        
        # Compensation finale : le T0 réel est AVANT l'observation.
        # Si on voit une montée à 10.5s et qu'on a 0.5s de lag, le vrai départ est à 10.0s.
        real_start = abs_start_observed - primary_lag
        return float(real_start)

    def _refine_end(self, idx: int, window: int = 15) -> float:
        """Find the sharpest combined drop around idx with sub-second precision and lag compensation."""
        search_min = int(max(0, idx - window))
        search_max = int(min(len(self.signal), idx + window))
        
        x_fine, y_fine = self._get_interpolated_window(search_min, search_max)
        if len(y_fine) < 2:
            return float(idx)
            
        grad_primary = np.diff(y_fine)
        primary_lag = self.lags.get(self.primary_signal, 0.0)
        
        norm_grad = grad_primary / (np.max(np.abs(grad_primary)) + 1e-6)
        
        if 'cadence' in self.df.columns:
            cad_y = np.nan_to_num(self.df['cadence'].values[search_min:search_max])
            if len(cad_y) >= 2:
                cad_cs = CubicSpline(np.arange(len(cad_y)), cad_y)
                cad_fine = cad_cs(x_fine)
                grad_cadence = np.diff(cad_fine)
                norm_grad += grad_cadence / (np.max(np.abs(grad_cadence)) + 1e-6)
            
        best_grad_idx = np.argmin(norm_grad)
        abs_end_observed = search_min + (best_grad_idx + 1) * self.dt
        
        real_end = abs_end_observed - primary_lag
        return float(real_end)

    def seek(self, target_duration: int, expected_start: int, search_window: int = 60, min_start: Optional[int] = None, strict_duration: bool = False) -> Optional[Dict]:
        """
        Seeks for an interval with Meta-Precision (sub-second float results).
        """
        # Call base method to get coarse window
        coarse = super().seek(target_duration, expected_start, search_window, min_start, strict_duration)
        if not coarse:
            return None
            
        # The base seek already refined using integer gradients.
        # We re-refine with Spline for sub-second precision.
        refine_window = 5 if strict_duration else 15
        
        # Important: use the coarse outputs as seed for spline refinement
        refined_start = self._refine_start(int(coarse['start']), window=refine_window)
        refined_end = self._refine_end(int(coarse['end']), window=refine_window)
        
        if strict_duration:
             # Logic for strict duration: keep exact duration but shift start/end based on best spline match
             # Or we allow small sub-second drift? 
             # For now, let's allow the float precision.
             pass

        # Calculate avg on the float range is tricky with discrete samples.
        # For metric calculation, we keep using the floor/ceil of the indices or weighted average?
        # Let's use the rounded indices for metrics for now, but return float for tracking.
        idx_start = int(round(refined_start))
        idx_end = int(round(refined_end))
        avg_val = np.mean(self.signal[idx_start:idx_end])
        
        return {
            'start': refined_start,
            'end': refined_end,
            'duration': refined_end - refined_start,
            'avg': float(avg_val),
            'method': 'meta_spline'
        }
