import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

class PureSignalMatcher:
    """
    Experimental Signal Processing Engine for Interval Detection.
    Strategies:
    1. Difference of Means (DoM) for edge detection.
    2. Cadence "Snap" for precise start alignment.
    3. Plateau Stability Check for validation.
    """

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.sample_rate = 1 # Assuming 1Hz

    def detect_edges_dom(self, signal: np.ndarray, window: int = 5) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detects transitions using Difference of Means.
        Score = |Mean(T:T+W) - Mean(T-W:T)|
        """
        s_series = pd.Series(signal)
        left_mean = s_series.rolling(window=window).mean()
        right_mean = s_series.rolling(window=window).mean().shift(-window)
        
        dom = (right_mean - left_mean).abs()
        dom_signed = right_mean - left_mean
        return dom.fillna(0).values, dom_signed.fillna(0).values

    def snap_to_cadence(self, tentative_idx: int, cadence_arr: np.ndarray, window_sec: int = 3) -> int:
        """
        Refines a start index by looking for a sharp rise in cadence.
        """
        if cadence_arr is None or len(cadence_arr) == 0:
            return tentative_idx
            
        start_search = max(0, tentative_idx - window_sec)
        end_search = min(len(cadence_arr), tentative_idx + window_sec)
        
        segment = cadence_arr[start_search:end_search]
        if len(segment) < 2:
            return tentative_idx
            
        grad = np.diff(segment)
        if np.max(grad) > 5: 
            offset = np.argmax(grad) 
            return start_search + offset
            
        return tentative_idx

    def validate_plateau(self, signal_segment: np.ndarray) -> float:
        """Returns Coefficient of Variation (CV)."""
        if len(signal_segment) < 5:
            return 999.0
        mean = np.mean(signal_segment)
        if mean == 0: return 999.0
        std = np.std(signal_segment)
        return std / mean

    def find_best_match(
        self, 
        signal: np.ndarray, 
        cadence: np.ndarray,
        target_duration: int, 
        target_min: float,
        start_search_idx: int,
        search_window: int = 300
    ) -> Optional[Dict]:
        """
        Finds the best interval match for the target using DoM, Cadence, and Plateau logic.
        """
        # Bounds check and casting
        start_search_idx = int(start_search_idx)
        search_window = int(search_window)
        target_duration = int(target_duration)
        
        end_search = min(len(signal), start_search_idx + search_window)
        if start_search_idx >= len(signal):
            return None
            
        # Optimize: Local Window + Padding
        pad = 10
        w_start = max(0, start_search_idx - pad)
        w_end = min(len(signal), end_search + target_duration + pad)
        
        local_sig = signal[w_start:w_end]
        local_cad = cadence[w_start:w_end] if cadence is not None else None
        
        # 1. DoM Calculation
        dom, dom_signed = self.detect_edges_dom(local_sig, window=5)
        
        # 2. Find Candidate STARTS
        threshold = np.max(dom) * 0.3 if len(dom) > 0 else 0
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(dom_signed, height=threshold, distance=10)
        
        candidates = []
        for p in peaks:
            abs_start = w_start + p
            if abs_start < start_search_idx: continue
            
            # Snap to Cadence
            refined_start = self.snap_to_cadence(p, local_cad) if local_cad is not None else p
            abs_refined_start = w_start + refined_start
            
            # Check potential END
            expected_end = refined_start + target_duration
            search_range = 15
            
            search_s = max(0, expected_end - search_range)
            search_e = min(len(dom_signed), expected_end + search_range)
            
            # Look for negative peaks (drops)
            end_segment = -dom_signed[search_s:search_e]
            end_peaks, _ = find_peaks(end_segment, height=threshold, distance=5)
            
            best_end = expected_end
            if len(end_peaks) > 0:
                closest_p = min(end_peaks, key=lambda x: abs((search_s + x) - expected_end))
                best_end = search_s + closest_p
            
            abs_refined_end = w_start + best_end
            actual_dur = abs_refined_end - abs_refined_start
            
            # Validate Plateau
            plateau_seg = local_sig[refined_start:best_end]
            cv = self.validate_plateau(plateau_seg)
            
            # Scoring
            dur_err = abs(actual_dur - target_duration)
            avg_int = np.mean(plateau_seg) if len(plateau_seg) > 0 else 0
            int_err = abs(avg_int - target_min) / target_min if target_min > 0 else 1.0
            
            # Proximity Penalty (Wait 120s => ~20 score penalty)
            prox_penalty = (abs_refined_start - start_search_idx) / search_window * 20.0
            
            score = (dur_err * 1.0) + (int_err * 100) + (cv * 100) + prox_penalty
            
            candidates.append({
                "start": abs_refined_start,
                "end": abs_refined_end,
                "score": score,
                "cv": cv
            })
            
        if not candidates:
            return None
            
        best = min(candidates, key=lambda x: x['score'])
        return best

    def match_sequence(self, target_grid: List[Dict], start_hint: int = 0) -> List[Dict]:
        """
        Runs the matching logic sequentially for a list of targets.
        Compatible with IntervalMatcher.
        """
        results = []
        current_ptr = start_hint
        
        signal_col = 'power' if 'power' in self.df.columns else 'speed'
        signal = self.df[signal_col].fillna(0).values
        cadence = self.df['cadence'].fillna(0).values if 'cadence' in self.df.columns else None

        for idx, target in enumerate(target_grid):
            dur = int(target.get('duration', 0))
            if dur <= 0: continue
            
            t_min = float(target.get('target_min', 0) or 0)
            
            # Use larger window for first item or if previous was not found
            window = 600 if idx == 0 else 300
            
            match = self.find_best_match(
                signal=signal,
                cadence=cadence,
                target_duration=dur,
                target_min=t_min,
                start_search_idx=current_ptr,
                search_window=window
            )
            
            if match:
                res = {
                    "status": "matched",
                    "start_index": match['start'],
                    "end_index": match['end'],
                    "confidence": 1.0 / (1.0 + match['score']), # Mock confidence
                    "target_index": idx
                }
                results.append(res)
                current_ptr = match['end']
            else:
                current_ptr += dur # Advance blindly
        
        return results
