"""
Global Candidate Matcher V4 - Paradigm Shift for Interval Detection

This module replaces the greedy sequential approach with a Global Candidate Scan:
1. Scan entire file for ALL potential work regions (above intensity floor)
2. Score each candidate by (Intensity, Duration, Stability, Recovery Coherence)
3. Select N best candidates forming a coherent temporal sequence

Key Features:
- Intensity Floor Enforcement: Reject candidates < 80% of target
- Recovery Coherence: Bonus for candidates where gap matches planned rest
- Physiological Lag Correction: Plateau trim + HR lag compensation

Author: Project K Team
Version: 4.0.0
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from scipy.signal import find_peaks
from scipy.ndimage import uniform_filter1d


class GlobalCandidateMatcher:
    """
    V4: Global Candidate Scan Paradigm.
    
    Instead of matching one-by-one (domino effect), this matcher:
    1. Identifies ALL high-intensity regions in the file
    2. Scores them against each target in the grid
    3. Selects the best temporal sequence using dynamic programming
    """

    # Configuration
    INTENSITY_FLOOR_RATIO = 0.85      # Reject candidates < 85% of target (was 80%)
    RECOVERY_TOLERANCE = 0.25          # ±25% tolerance on rest duration
    PLATEAU_TRIM_START = 8             # Seconds to trim at start for metrics
    PLATEAU_TRIM_END = 5               # Seconds to trim at end for metrics
    DOM_WINDOW = 5                     # Difference of Means window size
    MIN_SEGMENT_DURATION = 15          # Minimum work segment duration

    def __init__(self, df: pd.DataFrame, sport: str = 'bike'):
        self.df = df
        self.sport = sport
        self.sample_rate = 1  # Assuming 1Hz
        
        # Select primary signal
        if 'power' in df.columns and df['power'].notna().any():
            self.signal_col = 'power'
        elif 'speed' in df.columns:
            self.signal_col = 'speed'
        else:
            self.signal_col = 'power'
        
        self.signal = df[self.signal_col].fillna(0).values
        self.cadence = df['cadence'].fillna(0).values if 'cadence' in df.columns else None
        
        # Precompute session statistics
        active_mask = self.signal > np.mean(self.signal) * 0.3
        if active_mask.sum() > 100:
            self.session_max = np.percentile(self.signal[active_mask], 95)
            self.session_mean = np.mean(self.signal[active_mask])
        else:
            self.session_max = np.max(self.signal) if len(self.signal) > 0 else 0
            self.session_mean = np.mean(self.signal) if len(self.signal) > 0 else 0

    def detect_edges_dom(self, window: int = 5) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detects transitions using Difference of Means.
        Returns (absolute DoM, signed DoM).
        """
        s_series = pd.Series(self.signal)
        left_mean = s_series.rolling(window=window, min_periods=1).mean()
        right_mean = s_series.rolling(window=window, min_periods=1).mean().shift(-window)
        
        dom_signed = (right_mean - left_mean).fillna(0).values
        dom_abs = np.abs(dom_signed)
        return dom_abs, dom_signed

    def find_high_intensity_regions(
        self, 
        intensity_floor: float,
        min_duration: int = 15
    ) -> List[Dict]:
        """
        Finds all continuous regions above the intensity floor.
        
        Returns list of {start, end, duration, mean_intensity, stability_cv}
        """
        above_floor = self.signal >= intensity_floor
        
        regions = []
        in_region = False
        start_idx = 0
        
        for i in range(len(above_floor)):
            if above_floor[i] and not in_region:
                # Start new region
                in_region = True
                start_idx = i
            elif not above_floor[i] and in_region:
                # End current region
                in_region = False
                duration = i - start_idx
                if duration >= min_duration:
                    segment = self.signal[start_idx:i]
                    regions.append({
                        'start': start_idx,
                        'end': i,
                        'duration': duration,
                        'mean_intensity': float(np.mean(segment)),
                        'stability_cv': float(np.std(segment) / np.mean(segment)) if np.mean(segment) > 0 else 1.0
                    })
        
        # Handle region that extends to end
        if in_region:
            duration = len(self.signal) - start_idx
            if duration >= min_duration:
                segment = self.signal[start_idx:]
                regions.append({
                    'start': start_idx,
                    'end': len(self.signal),
                    'duration': duration,
                    'mean_intensity': float(np.mean(segment)),
                    'stability_cv': float(np.std(segment) / np.mean(segment)) if np.mean(segment) > 0 else 1.0
                })
        
        return regions

    def snap_to_cadence(self, tentative_idx: int, search_window: int = 3) -> int:
        """
        Refines a start index by looking for a sharp rise in cadence.
        """
        if self.cadence is None or len(self.cadence) == 0:
            return tentative_idx
        
        start_search = max(0, tentative_idx - search_window)
        end_search = min(len(self.cadence), tentative_idx + search_window)
        
        segment = self.cadence[start_search:end_search]
        if len(segment) < 2:
            return tentative_idx
        
        grad = np.diff(segment)
        if len(grad) > 0 and np.max(grad) > 5:
            offset = np.argmax(grad)
            return start_search + offset
        
        return tentative_idx

    def refine_boundaries_dom(
        self, 
        region: Dict, 
        target_duration: int
    ) -> Tuple[int, int]:
        """
        Refines region boundaries using DoM edge detection.
        Returns (refined_start, refined_end).
        """
        dom_abs, dom_signed = self.detect_edges_dom(self.DOM_WINDOW)
        
        # Search for start edge near region start
        search_start = max(0, region['start'] - 15)
        search_end = min(len(self.signal), region['start'] + 15)
        
        start_window = dom_signed[search_start:search_end]
        if len(start_window) > 0:
            # Look for positive peaks (intensity rising)
            peaks, _ = find_peaks(start_window, height=np.max(start_window) * 0.3, distance=3)
            if len(peaks) > 0:
                best_start = search_start + peaks[0]
            else:
                best_start = region['start']
        else:
            best_start = region['start']
        
        # Snap to cadence if available
        best_start = self.snap_to_cadence(best_start)
        
        # Search for end edge
        expected_end = best_start + target_duration
        search_end_low = max(0, expected_end - 15)
        search_end_high = min(len(self.signal), expected_end + 15)
        
        end_window = -dom_signed[search_end_low:search_end_high]  # Negative for drops
        if len(end_window) > 0:
            peaks, _ = find_peaks(end_window, height=np.max(end_window) * 0.3, distance=3)
            if len(peaks) > 0:
                # Choose peak closest to expected end
                closest = min(peaks, key=lambda p: abs((search_end_low + p) - expected_end))
                best_end = search_end_low + closest
            else:
                best_end = expected_end
        else:
            best_end = expected_end
        
        # Clamp to valid range
        best_end = min(best_end, len(self.signal))
        best_start = max(0, best_start)
        
        return best_start, best_end

    def score_candidate(
        self,
        region: Dict,
        target: Dict,
        previous_match_end: Optional[int],
        planned_rest: Optional[int]
    ) -> float:
        """
        Scores a candidate region against a target.
        
        Score = w1 * intensity_score + w2 * duration_score + w3 * stability_score + w4 * recovery_coherence
        
        Lower score = better match (like cost function).
        """
        target_duration = int(target.get('duration', 0))
        target_min = float(target.get('target_min', 0) or 0)
        
        if target_min <= 0:
            # Default floor based on session
            target_min = self.session_mean * 0.8
        
        # --- Intensity Score ---
        # Deviation from target intensity (normalized)
        intensity_ratio = region['mean_intensity'] / target_min if target_min > 0 else 1.0
        # Penalize both over and under (but under more)
        if intensity_ratio < 1.0:
            intensity_error = (1.0 - intensity_ratio) * 2.0  # Heavier penalty for under
        else:
            intensity_error = (intensity_ratio - 1.0) * 0.5  # Lighter penalty for over
        
        # --- Duration Score ---
        # How close is the region to target duration
        duration_ratio = region['duration'] / target_duration if target_duration > 0 else 1.0
        if 0.8 <= duration_ratio <= 1.2:
            duration_error = abs(1.0 - duration_ratio)
        else:
            duration_error = abs(1.0 - duration_ratio) * 2.0  # Bigger penalty outside tolerance
        
        # --- Stability Score ---
        # Low CV = stable plateau = good
        stability_error = region['stability_cv'] * 0.5
        
        # --- Recovery Coherence Score ---
        recovery_error = 0.0
        if previous_match_end is not None and planned_rest is not None and planned_rest > 0:
            actual_gap = region['start'] - previous_match_end
            gap_ratio = actual_gap / planned_rest
            
            if 1.0 - self.RECOVERY_TOLERANCE <= gap_ratio <= 1.0 + self.RECOVERY_TOLERANCE:
                # Bonus: gap matches planned rest
                recovery_error = -0.3 * (1.0 - abs(1.0 - gap_ratio))
            else:
                # Penalty: gap doesn't match
                recovery_error = abs(1.0 - gap_ratio) * 0.5
        
        # --- Aggregate Score ---
        # Weights: Intensity (40%), Duration (30%), Stability (15%), Recovery (15%)
        score = (
            0.40 * intensity_error +
            0.30 * duration_error +
            0.15 * stability_error +
            0.15 * recovery_error
        )
        
        return score

    def match_sequence(
        self,
        target_grid: List[Dict],
        start_hint: int = 0
    ) -> List[Dict]:
        """
        Main entry point: Match target intervals using Global Candidate Scan.
        
        Algorithm:
        1. Calculate intensity floor from targets
        2. Find ALL regions above floor
        3. For each target, find best-scoring region that maintains temporal order
        4. Refine boundaries with DoM + Cadence
        5. Calculate plateau metrics
        
        Returns list of matched intervals with metrics.
        """
        if not target_grid or len(self.signal) == 0:
            return []
        
        # 1. Calculate intensity floor
        target_intensities = [float(t.get('target_min', 0) or 0) for t in target_grid]
        max_target = max(target_intensities) if target_intensities else self.session_mean
        
        # Floor = 85% of max target AND 75% of session max (stricter)
        intensity_floor = max(
            max_target * self.INTENSITY_FLOOR_RATIO,
            self.session_max * 0.75  # Raised from 0.65 to 0.75
        )
        
        # For low-intensity targets (endurance), adjust floor down
        if max_target < self.session_mean * 0.8:
            intensity_floor = max_target * 0.7
        
        # 2. Find all high-intensity regions
        regions = self.find_high_intensity_regions(
            intensity_floor=intensity_floor,
            min_duration=self.MIN_SEGMENT_DURATION
        )
        
        if not regions:
            # Fallback: lower floor and retry
            intensity_floor *= 0.7
            regions = self.find_high_intensity_regions(
                intensity_floor=intensity_floor,
                min_duration=self.MIN_SEGMENT_DURATION
            )
        
        # --- MAIN SET DETECTION ---
        # Look for where consistent work patterns begin by analyzing gaps
        # The main set will have consistent rest durations between work blocks
        # Warm-up will have irregular gaps or different durations
        
        expected_rest = 60  # Default expected rest (most interval sets use 60s or 30s)
        expected_work = target_grid[0].get('duration', 120) if target_grid else 120
        
        # Try to infer expected rest from target grid pattern
        # (Future: could come from Nolio plan parsing)
        
        if len(regions) >= 3:
            # Calculate gaps between all regions
            gaps = []
            for i in range(1, len(regions)):
                gap = regions[i]['start'] - regions[i-1]['end']
                gaps.append((i, gap))
            
            # Find first region that starts a "consistent gap" sequence
            # A consistent sequence has 3+ consecutive gaps within 20% of each other
            main_set_start_idx = 0
            for i in range(len(gaps) - 2):
                g1 = gaps[i][1]
                g2 = gaps[i+1][1]
                g3 = gaps[i+2][1] if i+2 < len(gaps) else g2
                
                # Check if these 3 gaps are similar (within 20%)
                avg_gap = (g1 + g2 + g3) / 3
                if avg_gap > 10:  # Must be meaningful gaps (not fused regions)
                    variation = max(abs(g1 - avg_gap), abs(g2 - avg_gap), abs(g3 - avg_gap))
                    if variation / avg_gap < 0.25:  # Within 25% of average
                        # Found start of main set
                        main_set_start_idx = gaps[i][0] - 1  # Convert from gap index to region index
                        break
            
            if main_set_start_idx > 0:
                # Skip warm-up regions
                regions = regions[main_set_start_idx:]
        
        # 3. Match each target in sequence
        results = []
        current_end = start_hint
        region_idx = 0
        
        for target_idx, target in enumerate(target_grid):
            target_duration = int(target.get('duration', 0))
            target_min = float(target.get('target_min', 0) or 0)
            
            if target_duration <= 0:
                continue
            
            # Get planned rest from previous target (if any)
            planned_rest = None
            if target_idx > 0 and len(results) > 0:
                # Check if previous target had a rest component
                prev_target = target_grid[target_idx - 1]
                # Nolio often encodes rest in the following target's offset
                # For now, use the gap between consecutive work in the plan
                planned_rest = target.get('planned_rest', None)
            
            # Find best candidate region
            best_region = None
            best_score = float('inf')
            best_region_idx = region_idx
            
            # Search forward from current position
            for i in range(region_idx, len(regions)):
                region = regions[i]
                
                # Must start after current position (temporal order)
                if region['end'] <= current_end:
                    continue
                
                # Hard filter: intensity floor
                if region['mean_intensity'] < intensity_floor:
                    continue
                
                # Hard filter: duration sanity (at least 50% of target)
                if region['duration'] < target_duration * 0.5:
                    continue
                
                # Score this candidate
                prev_end = results[-1]['end_index'] if results else None
                score = self.score_candidate(region, target, prev_end, planned_rest)
                
                if score < best_score:
                    best_score = score
                    best_region = region
                    best_region_idx = i
                
                # Stop searching if we're too far ahead (optimization)
                if region['start'] > current_end + target_duration * 3:
                    break
            
            if best_region is None:
                # No matching region found
                current_end += target_duration  # Advance pointer blindly
                continue
            
            # 4. Refine boundaries with DoM + Cadence
            refined_start, refined_end = self.refine_boundaries_dom(best_region, target_duration)
            
            # Clamp duration to reasonable range
            actual_duration = refined_end - refined_start
            if actual_duration > target_duration * 1.5:
                refined_end = refined_start + int(target_duration * 1.2)
            elif actual_duration < target_duration * 0.7:
                refined_end = min(refined_start + target_duration, len(self.signal))
            
            # Check if this region can contain MORE intervals (sub-segmentation)
            # If so, don't advance region_idx - let next target try the same region
            remaining_region_duration = best_region['end'] - refined_end
            can_hold_another = remaining_region_duration >= target_duration * 0.6
            
            # 5. Calculate plateau metrics (with lag correction)
            plateau_metrics = self._calculate_plateau_metrics(refined_start, refined_end)
            
            # Build result
            realized = plateau_metrics.get(f'avg_{self.signal_col}', 0)
            respect_score = (realized / target_min * 100) if target_min > 0 else None
            
            result = {
                "status": "matched",
                "source": "global_scan",
                "confidence": max(0.0, 1.0 - best_score),
                "lap_index": None,
                "target_index": target_idx,
                "start_index": refined_start,
                "end_index": refined_end,
                "duration_sec": refined_end - refined_start,
                "expected_duration": target_duration,
                "avg_power": plateau_metrics.get('avg_power'),
                "avg_speed": plateau_metrics.get('avg_speed'),
                "avg_hr": plateau_metrics.get('avg_hr'),
                "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
                "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
                "respect_score": respect_score,
                "match_score": best_score,
                "target": target
            }
            results.append(result)
            
            # Update pointers - CRITICAL: Handle sub-segmentation
            current_end = refined_end
            if can_hold_another:
                # Large region: update the region's start to point past this match
                # but don't advance region_idx so we can reuse it
                regions[best_region_idx] = {
                    **best_region,
                    'start': refined_end,
                    'duration': best_region['end'] - refined_end
                }
            else:
                # Region fully consumed, move to next
                region_idx = best_region_idx + 1
        
        return results

    def _calculate_plateau_metrics(self, start_idx: int, end_idx: int) -> Dict:
        """
        Calculates metrics on the stabilized plateau (with trim).
        """
        # Trim transients
        trim_start = min(self.PLATEAU_TRIM_START, (end_idx - start_idx) // 4)
        trim_end = min(self.PLATEAU_TRIM_END, (end_idx - start_idx) // 4)
        
        plateau_start = start_idx + trim_start
        plateau_end = end_idx - trim_end
        
        if plateau_end <= plateau_start:
            plateau_start = start_idx
            plateau_end = end_idx
        
        metrics = {}
        
        # Power
        if 'power' in self.df.columns:
            seg = self.df['power'].iloc[start_idx:end_idx].dropna()
            plateau_seg = self.df['power'].iloc[plateau_start:plateau_end].dropna()
            metrics['avg_power'] = float(seg.mean()) if len(seg) > 0 else None
            metrics['plateau_avg_power'] = float(plateau_seg.mean()) if len(plateau_seg) > 0 else None
        
        # Speed
        if 'speed' in self.df.columns:
            seg = self.df['speed'].iloc[start_idx:end_idx].dropna()
            plateau_seg = self.df['speed'].iloc[plateau_start:plateau_end].dropna()
            metrics['avg_speed'] = float(seg.mean()) if len(seg) > 0 else None
            metrics['plateau_avg_speed'] = float(plateau_seg.mean()) if len(plateau_seg) > 0 else None
        
        # Heart Rate (with +15s lag compensation)
        if 'heart_rate' in self.df.columns:
            hr_lag = 15
            hr_start = min(start_idx + hr_lag, end_idx)
            hr_seg = self.df['heart_rate'].iloc[hr_start:end_idx].dropna()
            metrics['avg_hr'] = float(hr_seg.mean()) if len(hr_seg) > 0 else None
        
        return metrics

    def find_best_match(
        self,
        signal: np.ndarray,
        cadence: np.ndarray,
        target_duration: int,
        target_min: float,
        start_search_idx: int,
        search_window: int = 900
    ) -> Optional[Dict]:
        """
        Per-target compatibility method for IntervalMatcher integration.
        
        Uses Global Candidate Scan internally but returns a single match
        compatible with the old PureSignalMatcher interface.
        
        Args:
            signal: Power or speed array (ignored, uses self.signal)
            cadence: Cadence array (ignored, uses self.cadence)
            target_duration: Expected duration in seconds
            target_min: Target intensity (power/speed)
            start_search_idx: Where to start searching
            search_window: How far ahead to search
            
        Returns:
            Dict with {start, end, score, cv} or None if no match found
        """
        # Calculate intensity floor (80% of target or 65% of session max)
        if target_min > 0:
            intensity_floor = max(
                target_min * self.INTENSITY_FLOOR_RATIO,
                self.session_max * 0.65
            )
        else:
            intensity_floor = self.session_max * 0.65
        
        # Find regions above floor within search window
        search_end = min(len(self.signal), start_search_idx + search_window)
        
        # Local search within window
        local_regions = []
        above_floor = self.signal >= intensity_floor
        in_region = False
        region_start = 0
        
        for i in range(start_search_idx, search_end):
            if above_floor[i] and not in_region:
                in_region = True
                region_start = i
            elif not above_floor[i] and in_region:
                in_region = False
                duration = i - region_start
                if duration >= 10:  # Lower min for per-target search
                    segment = self.signal[region_start:i]
                    local_regions.append({
                        'start': region_start,
                        'end': i,
                        'duration': duration,
                        'mean_intensity': float(np.mean(segment)),
                        'stability_cv': float(np.std(segment) / np.mean(segment)) if np.mean(segment) > 0 else 1.0
                    })
        
        # Handle open region at end
        if in_region:
            duration = search_end - region_start
            if duration >= 10:
                segment = self.signal[region_start:search_end]
                local_regions.append({
                    'start': region_start,
                    'end': search_end,
                    'duration': duration,
                    'mean_intensity': float(np.mean(segment)),
                    'stability_cv': float(np.std(segment) / np.mean(segment)) if np.mean(segment) > 0 else 1.0
                })
        
        if not local_regions:
            return None
        
        # Score each candidate
        target = {'duration': target_duration, 'target_min': target_min}
        best_region = None
        best_score = float('inf')
        
        for region in local_regions:
            score = self.score_candidate(region, target, None, None)
            
            # Add proximity penalty (but much less aggressive than old implementation)
            proximity_penalty = abs(region['start'] - start_search_idx) / search_window * 0.3
            total_score = score + proximity_penalty
            
            if total_score < best_score:
                best_score = total_score
                best_region = region
        
        if best_region is None:
            return None
        
        # Refine boundaries
        refined_start, refined_end = self.refine_boundaries_dom(best_region, target_duration)
        
        # Clamp duration
        actual_dur = refined_end - refined_start
        if actual_dur > target_duration * 1.5:
            refined_end = refined_start + int(target_duration * 1.2)
        elif actual_dur < target_duration * 0.7:
            refined_end = min(refined_start + target_duration, len(self.signal))
        
        return {
            'start': refined_start,
            'end': refined_end,
            'score': best_score * 100,  # Scale to old interface
            'cv': best_region['stability_cv']
        }

