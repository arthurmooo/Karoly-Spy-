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
from projectk_core.processing.edge_detector import MultiSignalEdgeDetector, AdaptiveHysteresis


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

    def __init__(self, df: pd.DataFrame, sport: str = 'bike', profile: Optional['PhysioProfile'] = None):
        self.df = df
        self.sport = sport
        self.profile = profile
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

        # Initialize multi-signal edge detector for surgical precision
        self.edge_detector = MultiSignalEdgeDetector(df, sport=sport, profile=profile)

        # Initialize adaptive hysteresis for zone-based thresholds
        self.hysteresis = AdaptiveHysteresis(sport=sport)

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

    def snap_to_cadence(self, tentative_idx: int, search_window: int = 8, edge_type: str = 'start', target_intensity: Optional[float] = None) -> int:
        """
        Refines an index using MultiSignalEdgeDetector for surgical precision (+/-2s).

        Uses cadence gradient as leading indicator (1-3s before power/speed),
        cross-validates with power/speed gradient, and expands search window to ±8s.

        Args:
            tentative_idx: Initial estimate of edge position
            search_window: Search window in seconds (default 8, was 3)
            edge_type: 'start' for interval beginning, 'end' for interval end
            target_intensity: Optional target for adaptive thresholds

        Returns:
            Refined index with surgical precision
        """
        if len(self.df) == 0:
            return tentative_idx

        # Use the multi-signal edge detector for precision
        edge_result = self.edge_detector.find_edge(
            tentative_idx=tentative_idx,
            edge_type=edge_type,
            target_intensity=target_intensity
        )

        return edge_result.index

    def refine_boundaries_dom(
        self,
        region: Dict,
        target_duration: int,
        target_intensity: Optional[float] = None
    ) -> Tuple[int, int]:
        """
        Refines region boundaries using MultiSignalEdgeDetector for surgical precision.

        V2: Uses multi-signal cross-validation (cadence + power/speed) instead of
        simple DoM peaks. Achieves +/-2s precision on interval boundaries.

        Returns (refined_start, refined_end).
        """
        # Use MultiSignalEdgeDetector for surgical precision
        refined_start, refined_end = self.edge_detector.refine_boundaries(
            start_idx=region['start'],
            end_idx=region['end'],
            target_duration=target_duration
        )

        # Additional DoM-based validation for edge cases
        dom_abs, dom_signed = self.detect_edges_dom(self.DOM_WINDOW)

        # Validate start with DoM (sanity check)
        search_start = max(0, refined_start - 5)
        search_end = min(len(self.signal), refined_start + 5)
        if search_end > search_start:
            start_window = dom_signed[search_start:search_end]
            if len(start_window) > 0:
                # Check if there's a stronger edge nearby
                peaks, _ = find_peaks(start_window, height=np.max(start_window) * 0.5, distance=2)
                if len(peaks) > 0:
                    dom_start = search_start + peaks[0]
                    # Only override if very close and stronger signal
                    if abs(dom_start - refined_start) <= 2:
                        refined_start = dom_start

        # Validate end with DoM
        search_end_low = max(0, refined_end - 5)
        search_end_high = min(len(self.signal), refined_end + 5)
        if search_end_high > search_end_low:
            end_window = -dom_signed[search_end_low:search_end_high]
            if len(end_window) > 0:
                peaks, _ = find_peaks(end_window, height=np.max(end_window) * 0.5, distance=2)
                if len(peaks) > 0:
                    dom_end = search_end_low + peaks[-1]
                    if abs(dom_end - refined_end) <= 2:
                        refined_end = dom_end

        # Clamp to valid range
        refined_start = max(0, refined_start)
        refined_end = min(len(self.signal), refined_end)

        # Ensure valid interval
        if refined_end <= refined_start:
            refined_end = min(region['end'], len(self.signal))
            refined_start = max(0, region['start'])

        return refined_start, refined_end

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
        V4.1 ZERO-DEFECT: Match target intervals using Global Candidate Scan
        with Dynamic Floor Decay, Rhythm Prediction, and Gap Scanning.
        
        Algorithm:
        1. Calculate initial intensity floor from targets
        2. Find ALL regions above floor (with Main Set Detection)
        3. For each target:
           a. Apply Dynamic Floor Decay (fatigue model)
           b. Use Rhythm Prediction if sequence established
           c. Find best-scoring region or use temporal prior
        4. Gap Scan: Re-process missed intervals with relaxed thresholds
        5. Calculate plateau metrics
        
        Returns list of matched intervals with metrics.
        """
        if not target_grid or len(self.signal) == 0:
            return []
        
        # 1. Calculate initial intensity floor
        target_intensities = [float(t.get('target_min', 0) or 0) for t in target_grid]
        max_target = max(target_intensities) if target_intensities else self.session_mean
        target_duration = int(target_grid[0].get('duration', 120))
        
        # Initial floor: 85% of target, but at least 70% of session max
        initial_floor = max(
            max_target * self.INTENSITY_FLOOR_RATIO,
            self.session_max * 0.70
        )
        
        # For low-intensity targets (endurance), adjust floor down
        if max_target < self.session_mean * 0.8:
            initial_floor = max_target * 0.65
        
        # 2. Find all high-intensity regions (using lower floor to capture fatigued reps)
        # Use 70% floor for discovery, we'll validate with dynamic floor later
        discovery_floor = initial_floor * 0.80
        regions = self.find_high_intensity_regions(
            intensity_floor=discovery_floor,
            min_duration=max(10, target_duration // 4)
        )
        
        if not regions:
            discovery_floor *= 0.7
            regions = self.find_high_intensity_regions(
                intensity_floor=discovery_floor,
                min_duration=10
            )
        
        # --- MAIN SET DETECTION (V4.2) ---
        # Key insight: Main set has BOTH consistent gaps AND high intensity
        # Warm-up might have consistent-ish gaps but lower intensity
        expected_rest = 60  # Default
        main_set_start_idx = 0
        detected_median_rest = None
        
        # Intensity threshold for main set: must be > 80% of session max
        main_set_intensity_threshold = self.session_max * 0.80
        
        if len(regions) >= 3:
            gaps = []
            for i in range(1, len(regions)):
                gap = regions[i]['start'] - regions[i-1]['end']
                gaps.append((i, gap))
            
            # Find consistent gap sequence where:
            # 1. 3+ consecutive gaps within 20% of each other
            # 2. Gaps are "rest-like" (20s to 180s for typical intervals)
            # 3. Regions have HIGH intensity (> 80% of session max)
            for i in range(len(gaps) - 2):
                g1, g2 = gaps[i][1], gaps[i+1][1]
                g3 = gaps[i+2][1] if i+2 < len(gaps) else g2
                
                avg_gap = (g1 + g2 + g3) / 3
                
                # Skip if gaps are too short (<20s) or too long (>180s)
                if not (20 <= avg_gap <= 180):
                    continue
                
                # Check gap consistency
                variation = max(abs(g1 - avg_gap), abs(g2 - avg_gap), abs(g3 - avg_gap))
                gap_consistent = avg_gap > 0 and variation / avg_gap < 0.20
                
                if not gap_consistent:
                    continue
                
                # Check intensity of the regions AFTER this gap sequence starts
                # The regions at gaps[i], gaps[i+1], gaps[i+2] indices
                region_indices = [gaps[i][0] - 1, gaps[i][0], gaps[i+1][0], gaps[i+2][0] if i+2 < len(gaps) else gaps[i+1][0]]
                region_intensities = [regions[j]['mean_intensity'] for j in region_indices if j < len(regions)]
                
                # All regions must be high intensity
                all_high_intensity = all(
                    intensity >= main_set_intensity_threshold 
                    for intensity in region_intensities
                )
                
                if all_high_intensity:
                    main_set_start_idx = gaps[i][0] - 1  # Region before first gap
                    detected_median_rest = avg_gap
                    break
            
            if main_set_start_idx > 0:
                regions = regions[main_set_start_idx:]
        
        # 3. Match each target with Dynamic Floor Decay and Rhythm Prediction
        results = []
        current_end = start_hint
        region_idx = 0
        
        # Rhythm tracking
        detected_rests = []
        cycle_period = None  # work + rest duration
        
        # Constants for Zero-Defect
        FLOOR_DECAY_PER_REP = 0.015  # 1.5% decay per rep
        RHYTHM_SEARCH_WINDOW = 20    # ±20s around predicted timestamp
        
        for target_idx, target in enumerate(target_grid):
            target_duration = int(target.get('duration', 0))
            target_min = float(target.get('target_min', 0) or 0)
            
            if target_duration <= 0:
                continue
            
            # --- DYNAMIC FLOOR DECAY ---
            # After first few reps, lower the floor to account for fatigue
            reps_done = len(results)
            dynamic_floor = initial_floor * (1.0 - FLOOR_DECAY_PER_REP * reps_done)
            dynamic_floor = max(dynamic_floor, initial_floor * 0.70)  # Never below 70% of initial
            
            # --- RHYTHM PREDICTION ---
            # If we have established a rhythm, predict next work block
            predicted_start = None
            if len(results) >= 2:
                # Calculate median rest from detected intervals
                if len(detected_rests) >= 2:
                    median_rest = sorted(detected_rests)[len(detected_rests)//2]
                elif detected_median_rest:
                    median_rest = detected_median_rest
                else:
                    median_rest = 60  # Default
                
                # Predict next start = last_end + median_rest
                last_end = results[-1]['end_index']
                predicted_start = int(last_end + median_rest)
                
                # Also track cycle period for better prediction
                if len(results) >= 3:
                    recent_starts = [r['start_index'] for r in results[-3:]]
                    cycle_gaps = [recent_starts[i+1] - recent_starts[i] for i in range(len(recent_starts)-1)]
                    cycle_period = sum(cycle_gaps) / len(cycle_gaps) if cycle_gaps else None
            
            # Get planned rest from target
            planned_rest = target.get('planned_rest', None)
            
            # --- CANDIDATE SEARCH ---
            best_region = None
            best_score = float('inf')
            best_region_idx = region_idx
            
            # Strategy 1: Standard region search with dynamic floor
            for i in range(region_idx, len(regions)):
                region = regions[i]
                
                if region['end'] <= current_end:
                    continue
                
                # Dynamic floor check (not static initial_floor)
                if region['mean_intensity'] < dynamic_floor:
                    continue
                
                if region['duration'] < target_duration * 0.4:
                    continue
                
                prev_end = results[-1]['end_index'] if results else None
                score = self.score_candidate(region, target, prev_end, planned_rest)
                
                # Bonus for being close to predicted start (rhythm coherence)
                if predicted_start and abs(region['start'] - predicted_start) < RHYTHM_SEARCH_WINDOW:
                    score -= 0.2  # Strong bonus
                
                if score < best_score:
                    best_score = score
                    best_region = region
                    best_region_idx = i
                
                if region['start'] > current_end + target_duration * 4:
                    break
            
            # Strategy 2: Rhythm-Forced Local Search (if no region found but we have rhythm)
            if best_region is None and predicted_start is not None:
                # Force a local scan around predicted_start with even lower floor
                forced_floor = dynamic_floor * 0.85  # 15% more lenient
                search_start = max(0, predicted_start - RHYTHM_SEARCH_WINDOW)
                search_end = min(len(self.signal), predicted_start + target_duration + RHYTHM_SEARCH_WINDOW)
                
                # Look for any above-floor segment in this window
                local_segment = self.signal[search_start:search_end]
                if len(local_segment) > 0:
                    above_forced = local_segment >= forced_floor
                    if np.any(above_forced):
                        # Find the longest run above forced floor
                        runs = []
                        in_run = False
                        run_start = 0
                        for j in range(len(above_forced)):
                            if above_forced[j] and not in_run:
                                in_run = True
                                run_start = j
                            elif not above_forced[j] and in_run:
                                in_run = False
                                runs.append((run_start, j))
                        if in_run:
                            runs.append((run_start, len(above_forced)))
                        
                        if runs:
                            # Pick longest run
                            best_run = max(runs, key=lambda r: r[1] - r[0])
                            run_len = best_run[1] - best_run[0]
                            if run_len >= target_duration * 0.5:
                                seg = local_segment[best_run[0]:best_run[1]]
                                best_region = {
                                    'start': search_start + best_run[0],
                                    'end': search_start + best_run[1],
                                    'duration': run_len,
                                    'mean_intensity': float(np.mean(seg)),
                                    'stability_cv': float(np.std(seg) / np.mean(seg)) if np.mean(seg) > 0 else 1.0
                                }
                                best_score = 0.5  # Moderate confidence for forced match
            
            if best_region is None:
                # Record gap for later scanning
                current_end += target_duration
                continue
            
            # Refine boundaries
            refined_start, refined_end = self.refine_boundaries_dom(best_region, target_duration)
            
            # Clamp duration
            actual_duration = refined_end - refined_start
            if actual_duration > target_duration * 1.5:
                refined_end = refined_start + int(target_duration * 1.2)
            elif actual_duration < target_duration * 0.6:
                refined_end = min(refined_start + target_duration, len(self.signal))
            
            # Track rest duration for rhythm
            if results:
                rest_gap = refined_start - results[-1]['end_index']
                if 5 < rest_gap < target_duration * 3:
                    detected_rests.append(rest_gap)
            
            # Sub-segmentation check
            remaining = best_region['end'] - refined_end
            can_hold_another = remaining >= target_duration * 0.5
            
            # Calculate metrics
            plateau_metrics = self._calculate_plateau_metrics(refined_start, refined_end)
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
            
            current_end = refined_end
            if can_hold_another:
                regions[best_region_idx] = {
                    **best_region,
                    'start': refined_end,
                    'duration': remaining
                }
            else:
                region_idx = best_region_idx + 1
        
        # --- RECURSIVE GAP SCANNING ---
        # If we're missing targets, scan the gaps between detected intervals
        if len(results) < len(target_grid):
            results = self._gap_scan_recovery(
                target_grid, results, initial_floor, target_duration
            )
        
        # Sort results by target_index
        results.sort(key=lambda r: r['target_index'])
        
        return results
    
    def _gap_scan_recovery(
        self,
        target_grid: List[Dict],
        current_results: List[Dict],
        initial_floor: float,
        target_duration: int
    ) -> List[Dict]:
        """
        Recursive Gap Scanning: Find missed intervals in gaps between detected ones.
        Uses very low floor (60% of initial) and relies on temporal position.
        """
        if not current_results:
            return current_results
        
        # Sort by start_index to find gaps
        sorted_results = sorted(current_results, key=lambda r: r['start_index'])
        
        # Find which target indices are missing
        matched_indices = {r['target_index'] for r in sorted_results}
        missing_indices = [i for i in range(len(target_grid)) if i not in matched_indices]
        
        if not missing_indices:
            return current_results
        
        # Very low floor for gap recovery (60% of initial)
        gap_floor = initial_floor * 0.60
        
        for missing_idx in missing_indices:
            target = target_grid[missing_idx]
            target_dur = int(target.get('duration', 0))
            
            # Find temporal bounds for this missing interval
            # It should be between the previous and next matched intervals
            prev_result = None
            next_result = None
            
            for r in sorted_results:
                if r['target_index'] < missing_idx:
                    prev_result = r
                elif r['target_index'] > missing_idx and next_result is None:
                    next_result = r
                    break
            
            # Define search window
            if prev_result and next_result:
                search_start = prev_result['end_index']
                search_end = next_result['start_index']
            elif prev_result:
                search_start = prev_result['end_index']
                search_end = min(len(self.signal), search_start + target_dur * 3)
            elif next_result:
                search_end = next_result['start_index']
                search_start = max(0, search_end - target_dur * 3)
            else:
                continue
            
            # Search for any qualifying segment in this gap
            if search_end <= search_start:
                continue
            
            gap_signal = self.signal[search_start:search_end]
            above_floor = gap_signal >= gap_floor
            
            # Find runs
            runs = []
            in_run = False
            run_start = 0
            for j in range(len(above_floor)):
                if above_floor[j] and not in_run:
                    in_run = True
                    run_start = j
                elif not above_floor[j] and in_run:
                    in_run = False
                    if j - run_start >= target_dur * 0.4:
                        runs.append((run_start, j))
            if in_run and len(above_floor) - run_start >= target_dur * 0.4:
                runs.append((run_start, len(above_floor)))
            
            if runs:
                # Pick the run closest to expected position (based on rhythm)
                if prev_result:
                    expected_pos = prev_result['end_index'] + 60 - search_start
                else:
                    expected_pos = 0
                
                best_run = min(runs, key=lambda r: abs(r[0] - expected_pos))
                
                seg = gap_signal[best_run[0]:best_run[1]]
                start_idx = search_start + best_run[0]
                end_idx = search_start + best_run[1]
                
                # Refine boundaries
                temp_region = {
                    'start': start_idx,
                    'end': end_idx, 
                    'duration': end_idx - start_idx,
                    'mean_intensity': float(np.mean(seg)),
                    'stability_cv': float(np.std(seg) / np.mean(seg)) if np.mean(seg) > 0 else 1.0
                }
                refined_start, refined_end = self.refine_boundaries_dom(temp_region, target_dur)
                
                plateau_metrics = self._calculate_plateau_metrics(refined_start, refined_end)
                target_min = float(target.get('target_min', 0) or 0)
                realized = plateau_metrics.get(f'avg_{self.signal_col}', 0)
                respect_score = (realized / target_min * 100) if target_min > 0 else None
                
                result = {
                    "status": "matched",
                    "source": "gap_scan",
                    "confidence": 0.6,  # Lower confidence for gap-recovered intervals
                    "lap_index": None,
                    "target_index": missing_idx,
                    "start_index": refined_start,
                    "end_index": refined_end,
                    "duration_sec": refined_end - refined_start,
                    "expected_duration": target_dur,
                    "avg_power": plateau_metrics.get('avg_power'),
                    "avg_speed": plateau_metrics.get('avg_speed'),
                    "avg_hr": plateau_metrics.get('avg_hr'),
                    "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
                    "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
                    "respect_score": respect_score,
                    "match_score": 0.4,
                    "target": target
                }
                current_results.append(result)
                sorted_results = sorted(current_results, key=lambda r: r['start_index'])
        
        return current_results

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
            
            # Karoly 2026-02-02: Wmoy excludes zeros
            avg_p = seg[seg > 0].mean() if not seg.empty else None
            plat_p = plateau_seg[plateau_seg > 0].mean() if not plateau_seg.empty else None
            
            metrics['avg_power'] = float(avg_p) if avg_p is not None and not pd.isna(avg_p) else None
            metrics['plateau_avg_power'] = float(plat_p) if plat_p is not None and not pd.isna(plat_p) else None
        
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

        # Filter regions by mean intensity (must be >= 90% of target)
        # This prevents warmup zones from being selected
        if target_min > 0:
            min_mean_intensity = target_min * 0.90
            local_regions = [r for r in local_regions if r['mean_intensity'] >= min_mean_intensity]

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

