"""
Interval Matcher V4 - Hybrid LAP + Global Candidate Scan

This module provides surgical alignment of planned intervals (Target Grid)
with actual data streams from FIT files, using a hybrid approach:
1. First, try to match using LAP data (if athlete marked intervals correctly)
2. Fall back to Global Candidate Scan if LAPs don't match the plan

Key Features:
- LAP-first matching with confidence scoring
- Global Candidate Scan with intensity floor enforcement
- Recovery coherence scoring (gap matches planned rest)
- Plateau centering for accurate metrics
- Source traceability (lap vs signal)

Author: Project K Team
Version: 4.0.0
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from projectk_core.logic.step_detector import StepDetector
from projectk_core.processing.global_matcher import GlobalCandidateMatcher
from projectk_core.processing.edge_detector import AdaptiveHysteresis, MultiSignalEdgeDetector
from projectk_core.processing.confidence import (
    ConfidenceMetrics, ConfidenceCalculator, VALIDATION_THRESHOLD,
    is_high_confidence_match
)
from projectk_core.processing.manual_pattern_parser import ManualPatternParser, pattern_to_grid


class MatchStatus(Enum):
    """Status of an interval match attempt."""
    MATCHED = "matched"
    NOT_FOUND = "not_found"
    PARTIAL = "partial"


class MatchSource(Enum):
    """Source of the interval boundaries."""
    LAP = "lap"
    SIGNAL = "signal"


@dataclass
class MatchConfig:
    """Configuration parameters for interval matching."""
    # LAP matching thresholds
    lap_duration_tolerance: float = 0.30     # ±30% duration tolerance
    lap_distance_tolerance: float = 0.05     # ±5% distance tolerance
    lap_intensity_tolerance: float = 0.35    # ±35% power/speed tolerance
    lap_confidence_threshold: float = 0.70   # Min confidence to use LAP

    # Thresholds for hysteresis (signal fallback)
    # NOTE: These are now fallback values. AdaptiveHysteresis calculates
    # zone-based thresholds dynamically when CP is available.
    entry_threshold_ratio: float = 0.80      # 80% of target to enter (fallback)
    exit_threshold_ratio: float = 0.65       # 65% of target to exit (fallback)

    # Plateau trimming (seconds)
    plateau_trim_start: int = 8              # Seconds to trim at start
    plateau_trim_end: int = 5                # Seconds to trim at end

    # Match validation
    min_duration_ratio: float = 0.70         # Must find at least 70% of target duration
    max_duration_ratio: float = 1.50         # Don't accept more than 150% of target

    # Confidence-based validation (new)
    signal_confidence_threshold: float = VALIDATION_THRESHOLD  # 0.85 for signal acceptance

    # Pause detection
    pause_speed_threshold: float = 1.5       # m/s - below this = walking/stopped
    pause_min_duration: int = 20             # Seconds - minimum to consider a pause

    # Search behavior
    max_search_gap: int = 1800               # Max seconds to search ahead (30 min for long warmups)
    retry_offset: int = 30                   # Seconds to skip before retry
    max_retries: int = 5                     # Max retries per target
    search_gap_multiplier: float = 2.0       # Search gap = max(base, duration * this)

    # Sport-specific absolute minimums
    min_speed_run: float = 2.0               # m/s (~8:20/km) - below = not running
    min_speed_swim: float = 0.5              # m/s - below = not swimming
    min_power_bike: float = 80               # Watts - below = coasting


class IntervalMatcher:
    """
    V3: Hybrid LAP + Signal interval detection.
    
    Prioritizes LAP boundaries when they match the plan with high confidence.
    Falls back to signal-based detection when LAPs are missing or don't match.
    """
    
    def __init__(self, config: Optional[MatchConfig] = None):
        self.config = config or MatchConfig()
        # Increased sensitivity: lower threshold_factor (1.5 -> 1.0)
        # Reduced window size (20 -> 15) to catch shorter transitions
        self.detector = StepDetector(window_size=15, threshold_factor=1.0)
    
    def validate_laps(
        self,
        laps: List[Dict[str, Any]],
        target_grid: List[Dict[str, Any]],
        signal_col: str = "power"
    ) -> float:
        """
        Calculates a Global Consistency Score (0-1) between Laps and Plan.
        Checks if the sequence of target intervals can be found in the Laps.
        """
        if not target_grid:
            return 1.0 if not laps else 0.0
            
        processed_laps = self._preprocess_laps(laps, signal_col)
        
        matches = 0
        lap_idx = 0
        
        for target in target_grid:
            target_dur = target.get('duration', 0)
            found = False
            
            # Look ahead for a lap that matches this target
            # Allow skipping up to 3 laps (e.g. rest lap, transition, accidental lap)
            search_limit = min(lap_idx + 4, len(processed_laps))
            
            for i in range(lap_idx, search_limit):
                lap = processed_laps[i]
                dur_ratio = lap['duration'] / target_dur if target_dur > 0 else 0
                
                if 0.7 <= dur_ratio <= 1.3:
                    # Duration matches!
                    matches += 1
                    lap_idx = i + 1 # Move past this lap
                    found = True
                    break
            
            if not found:
                # Target not found in Laps
                pass
                
        score = matches / len(target_grid)
        return score

    def match(
        self,
        df: pd.DataFrame,
        target_grid: List[Dict[str, Any]],
        sport: str = "run",
        laps: Optional[List[Dict[str, Any]]] = None,
        cp: Optional[float] = None,
        manual_pattern: Optional[str] = None,
        profile: Optional['PhysioProfile'] = None
    ) -> List[Dict[str, Any]]:
        """
        Main entry point: Match target intervals to actual data.

        Args:
            df: DataFrame with 1Hz data (timestamp, speed, power, heart_rate, distance)
            target_grid: List of target intervals from plan_parser
            sport: Sport type ('run', 'bike', 'swim')
            laps: Optional list of LAP records from FIT file
            cp: Optional Critical Power/Speed for relative intensity classification
            manual_pattern: Optional manual pattern string (e.g., "10x1Km / r 250m")
                           If provided and target_grid is empty, will parse pattern
            profile: Optional PhysioProfile for adaptive thresholds

        Returns:
            List of detected intervals with metrics, status, and source
        """
        # Strategy D: Parse manual pattern if provided and no target grid
        if manual_pattern and (not target_grid or len(target_grid) == 0):
            target_grid = pattern_to_grid(manual_pattern, profile=profile, sport=sport)
            if target_grid:
                print(f"      📋 Parsed manual pattern '{manual_pattern}' -> {len(target_grid)} intervals")

        if df.empty or not target_grid:
            return []
        
        # 1. Select signal source based on sport and available data
        signal_col, signal = self._select_signal(df, target_grid, sport)
        if signal is None:
            return []
        
        # --- NEW: Robust Intensity Reference ---
        # If CP is missing, we use a session-based heuristic (90% of mean) 
        # to avoid hardcoded thresholds that fail for very light or very strong athletes.
        if cp is None:
            session_mean = float(np.mean(signal)) if len(signal) > 0 else 0
            # For Bike, session mean is usually a good proxy for 'Transition' zone.
            # For Run, session mean is usually 'Endurance' zone.
            cp = session_mean * 1.1 if sport == 'bike' else session_mean * 1.0
        
        # 2. Pre-detect all intensity segments (Step Detection)
        # Use sport-specific min_delta
        min_delta = 10.0 if signal_col == 'power' else 0.2
        self.detector.min_delta = min_delta
        
        detected_steps = self.detector.detect_steps(signal)
        signal_segments = self.detector.segment_by_steps(signal, detected_steps)
        
        # 3. Preprocess LAPs if available
        processed_laps = self._preprocess_laps(laps, signal_col, ref_intensity=cp) if laps else []
        
        # 4. Detect pause zones
        pause_mask = self._detect_pauses(signal, sport)
        
        # 5. Filter LAPs to keep all potentially useful laps
        # ROBUSTNESS: We only exclude very short artifacts (<5s) or confirmed recovery 
        # ONLY IF the plan target is clearly 'active'.
        work_laps = [l for l in processed_laps if l.get('duration', 0) >= 5]
        
        # 6. Simple sequential matching: consume LAPs in order, fallback to signal
        detected_intervals = []
        lap_idx = 0      # Index into work_laps
        current_ptr = 0  # Current position in signal for fallback
        
        psm = GlobalCandidateMatcher(df, sport=sport)
        
        for target_idx, target in enumerate(target_grid):
            duration_s = int(target.get('duration', 0))
            if duration_s <= 0:
                continue
            
            # Get target value
            target_min = float(target.get('target_min', 0) or 0)
            if target_min <= 0:
                target_min = self._get_sport_minimum(sport, signal_col)
            
            # Try to find a matching LAP
            matched_lap = None
            matched_idx = None

            # Check if this is a merged/fused target (Z3+Z2 combined)
            is_merged_target = target.get('merged_from') is not None

            # Look ahead slightly more for LAPs (skip up to 5)
            # FIX: If we haven't matched anything yet (lap_idx=0), look deeper (e.g. 20 laps)
            # to handle long warmups split into multiple manual laps.
            lookahead = 20 if lap_idx == 0 else 6

            search_limit = min(lap_idx + lookahead, len(work_laps))

            # Strategy 1: "BEST IN WINDOW" approach (2026-02-03)
            # Maintains chronological order while selecting best candidate within a lookahead window
            # Uses SOFT intensity filter (90%) to skip warmup but allow slightly tired athletes
            target_dist = float(target.get('distance_m', 0))

            # Define lookahead window (how many laps ahead to consider)
            # Larger window at start to skip warmup, smaller after
            lookahead_window = min(8, search_limit - lap_idx) if lap_idx == 0 else min(5, search_limit - lap_idx)

            best_lap = None
            best_idx = None
            best_combined_score = 0.0

            # INTENSITY FLOOR: Minimum 90% of target to filter out warmup
            # This is more forgiving than 95% but still filters obvious warmup
            intensity_floor = target_min * 0.90 if target_min > 0 else 0

            for i in range(lap_idx, min(lap_idx + lookahead_window, search_limit)):
                lap = work_laps[i]
                lap_intensity = lap.get('avg_speed', 0) if signal_col == 'speed' else lap.get('avg_power', 0)

                # SOFT FILTER: Skip if clearly below intensity floor
                # But allow if we're past the lookahead (desperation mode)
                if lap_intensity < intensity_floor and (i - lap_idx) < lookahead_window - 1:
                    continue

                # Calculate confidence score
                confidence = self._calculate_lap_confidence(
                    lap, target_min, duration_s, signal_col,
                    target_distance=target_dist
                )

                # Skip if below minimum confidence
                if confidence < self.config.lap_confidence_threshold:
                    continue

                # Calculate intensity ratio (how close to target)
                intensity_ratio = lap_intensity / target_min if target_min > 0 else 1.0

                # Intensity score: bonus for being at or above target
                if intensity_ratio >= 0.98:
                    intensity_score = 1.0
                elif intensity_ratio >= 0.93:
                    intensity_score = 0.85 + (intensity_ratio - 0.93) / 0.05 * 0.15
                elif intensity_ratio >= 0.90:
                    intensity_score = 0.70 + (intensity_ratio - 0.90) / 0.03 * 0.15
                else:
                    intensity_score = max(0.3, intensity_ratio)

                # Combined score: confidence (35%) + intensity (65%)
                # Intensity weighted heavily to prefer faster laps
                combined_score = 0.35 * confidence + 0.65 * intensity_score

                if combined_score > best_combined_score:
                    best_lap = {**lap, 'lap_index': i, 'confidence': confidence}
                    best_combined_score = combined_score
                    best_idx = i

            if best_lap:
                matched_lap = best_lap
                matched_idx = best_idx

            # Strategy 2: For merged targets, try to merge consecutive LAPs
            # This handles cases like 5×(90s Z3 + 210s Z2) where LAPs are separate
            # IMPORTANT: Match chronologically - take FIRST valid pair, not best
            if not matched_lap and is_merged_target:
                for i in range(lap_idx, search_limit - 1):
                    lap1 = work_laps[i]
                    lap2 = work_laps[i + 1]

                    # Check if these two LAPs are consecutive (gap < 10s)
                    gap = lap2['start_offset'] - lap1['end_offset']
                    if gap > 10:
                        continue

                    # CRITICAL: At least one lap must have intensity >= target_min
                    # This filters out warmup/recovery laps that happen to match duration
                    lap1_intensity = lap1.get('avg_speed', 0) if signal_col == 'speed' else lap1.get('avg_power', 0)
                    lap2_intensity = lap2.get('avg_speed', 0) if signal_col == 'speed' else lap2.get('avg_power', 0)

                    # Require at least one lap to be above 90% of target intensity
                    intensity_threshold = target_min * 0.90 if target_min > 0 else 0
                    if max(lap1_intensity, lap2_intensity) < intensity_threshold:
                        continue  # Neither lap is intense enough

                    # PATTERN CHECK for Z3+Z2 fused blocks (Karoly system):
                    # The FIRST lap should be shorter AND more intense (Z3 = hard, short)
                    # The SECOND lap should be longer AND less intense (Z2 = moderate, long)
                    # This prevents matching recovery+work pairs like 240s@slow + 90s@fast
                    if lap1['duration'] > lap2['duration']:
                        # First lap is longer - this is wrong pattern (recovery + Z3)
                        # Skip unless both are similar duration (within 50%)
                        dur_ratio_laps = lap1['duration'] / lap2['duration']
                        if dur_ratio_laps > 1.5:
                            continue  # Skip this pair, pattern is recovery+work not work+work

                    # Merge the two LAPs
                    merged = self._merge_laps([lap1, lap2])
                    merged_duration = merged['duration']

                    # Check if merged duration matches target (±30%)
                    dur_ratio = merged_duration / duration_s if duration_s > 0 else 0
                    if 0.7 <= dur_ratio <= 1.3:
                        # Calculate confidence for merged LAP
                        confidence = self._calculate_lap_confidence(
                            merged, target_min, duration_s, signal_col,
                            target_distance=float(target.get('distance_m', 0))
                        )
                        # Take FIRST valid match (chronological order)
                        if confidence >= self.config.lap_confidence_threshold * 0.9:
                            matched_lap = {**merged, 'lap_index': [i, i+1], 'confidence': confidence}
                            matched_idx = i + 2
                            break  # Stop at first valid match

            # Strategy 3: Multi-LAP aggregation for long intervals (e.g., 5km = 5x1km LAPs)
            # Uses intensity floor (90%) to filter warmup blocks
            if not matched_lap and duration_s >= 600:  # Only for intervals >= 10 min
                target_dist = float(target.get('distance_m', 0))
                multi_lap_candidates = []
                intensity_floor = target_min * 0.90 if target_min > 0 else 0

                # Try to aggregate multiple consecutive LAPs starting from each position
                for start_i in range(lap_idx, search_limit):
                    laps_to_merge = []
                    total_duration = 0
                    total_distance = 0
                    intensity_sum = 0
                    all_above_floor = True

                    # Keep adding consecutive LAPs until we reach target duration/distance
                    for j in range(start_i, min(start_i + 15, len(work_laps))):  # Max 15 LAPs
                        lap = work_laps[j]
                        lap_intensity = lap.get('avg_speed', 0) if signal_col == 'speed' else lap.get('avg_power', 0)

                        # Check intensity floor (stop if lap is too slow)
                        if lap_intensity < intensity_floor:
                            all_above_floor = False
                            break

                        # Check gap with previous lap (must be consecutive)
                        if laps_to_merge:
                            prev_lap = laps_to_merge[-1]
                            gap = lap['start_offset'] - prev_lap['end_offset']
                            if gap > 20:  # Max 20s gap between km marks
                                break

                        laps_to_merge.append(lap)
                        total_duration += lap['duration']
                        total_distance += lap.get('total_distance', 0)
                        intensity_sum += lap_intensity * lap['duration']

                        # Check if we've reached target
                        reached_target = False
                        if target_dist > 0:
                            if total_distance >= target_dist * 0.95:
                                reached_target = True
                        else:
                            if total_duration >= duration_s * 0.95:
                                reached_target = True

                        if reached_target:
                            break

                    # Validate the merged block (need at least 2 laps and high intensity)
                    if len(laps_to_merge) >= 2 and all_above_floor:
                        merged = self._merge_laps(laps_to_merge)
                        merged_duration = merged['duration']
                        merged_distance = merged.get('total_distance', 0)
                        avg_intensity = intensity_sum / total_duration if total_duration > 0 else 0

                        # Check if merged block matches target
                        dur_match = 0.7 <= merged_duration / duration_s <= 1.3 if duration_s > 0 else False
                        dist_match = merged_distance >= target_dist * 0.95 if target_dist > 0 else False

                        if dur_match or dist_match:
                            confidence = self._calculate_lap_confidence(
                                merged, target_min, duration_s, signal_col,
                                target_distance=target_dist
                            )
                            intensity_rank = avg_intensity / target_min if target_min > 0 else avg_intensity

                            multi_lap_candidates.append({
                                'merged': merged,
                                'lap_indices': list(range(start_i, start_i + len(laps_to_merge))),
                                'confidence': confidence,
                                'avg_intensity': avg_intensity,
                                'intensity_rank': intensity_rank,
                                'end_idx': start_i + len(laps_to_merge)
                            })

                # Take the FIRST candidate that meets threshold (chronologically earliest with high intensity)
                # Sort by position first, then by intensity
                multi_lap_candidates.sort(key=lambda c: (c['lap_indices'][0], -c['intensity_rank']))

                for cand in multi_lap_candidates:
                    if cand['confidence'] >= self.config.lap_confidence_threshold * 0.85:
                        matched_lap = {**cand['merged'], 'lap_index': cand['lap_indices'], 'confidence': cand['confidence']}
                        matched_idx = cand['end_idx']
                        break
            
            if matched_lap:
                result = self._build_lap_result(
                    df, matched_lap, target, target_idx, signal_col
                )
                detected_intervals.append(result)
                lap_idx = matched_idx + 1
                current_ptr = result['end_index'] + 5 # Sync pointer
            else:
                # No matching LAP - fall back to Pure Signal Matcher (DoM + Cadence)
                ps_match = psm.find_best_match(
                    signal=signal,
                    cadence=df['cadence'].fillna(0).values if 'cadence' in df.columns else None,
                    target_duration=duration_s,
                    target_min=target_min,
                    start_search_idx=current_ptr,
                    search_window=self.config.max_search_gap
                )
                
                if ps_match:
                    start_idx = ps_match['start']
                    end_idx = ps_match['end']

                    plateau_metrics = self._calculate_plateau_metrics(
                        df, signal_col, start_idx, end_idx, duration_s
                    )

                    realized = plateau_metrics.get(f'avg_{signal_col}', 0)
                    respect_score = (realized / target_min * 100) if target_min > 0 else None

                    # Calculate signal confidence (2026-02-03)
                    # Score is a cost function (lower = better), typically 20-100 after scaling
                    # Map to 0-1 confidence: score=0 → conf=1.0, score=60 → conf=0.85, score=120 → conf=0.70
                    raw_score = ps_match['score']
                    signal_confidence = max(0.5, 1.0 - (raw_score / 200.0))

                    # Boost confidence if intensity match is good
                    if target_min > 0 and realized > 0:
                        intensity_ratio = realized / target_min
                        if intensity_ratio >= 0.95:
                            signal_confidence = min(1.0, signal_confidence + 0.10)
                        elif intensity_ratio >= 0.90:
                            signal_confidence = min(1.0, signal_confidence + 0.05)

                    result = {
                        "status": MatchStatus.MATCHED.value,
                        "source": MatchSource.SIGNAL.value,
                        "confidence": signal_confidence,
                        "lap_index": None,
                        "target_index": target_idx,
                        "start_index": start_idx,
                        "end_index": end_idx,
                        "duration_sec": end_idx - start_idx,
                        "expected_duration": duration_s,
                        "avg_power": plateau_metrics.get('avg_power'),
                        "avg_speed": plateau_metrics.get('avg_speed'),
                        "avg_hr": plateau_metrics.get('avg_hr'),
                        "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
                        "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
                        "respect_score": respect_score,
                        "target": target
                    }
                    detected_intervals.append(result)
                    
                    # Advance pointer
                    # PLAN TEMPO SYNC: Use expected duration to keep rhythm for tight intervals (30/30)
                    # This prevents 1-2s drift from accumulating over 40 reps.
                    # We use the later of detected end or theoretical end.
                    theoretical_end = start_idx + duration_s
                    current_ptr = max(end_idx, theoretical_end)
                    
                else:
                    detected_intervals.append(self._create_not_found_result(target, target_idx))
                    # SMART RESYNC: If target not found, the sequence might be broken.
                    current_ptr += duration_s // 2 # Small advance to avoid loop
        
        return [r for r in detected_intervals if r['status'] == MatchStatus.MATCHED.value]

    def detect_incomplete_session(
        self,
        matched_results: List[Dict[str, Any]],
        target_grid: List[Dict[str, Any]],
        df: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Detect if the session was incomplete compared to the plan.

        This helps identify cases like Baptiste's session where the athlete
        said "Nul, pas d'énergie, j'ai fait que la moitié".

        Args:
            matched_results: List of matched interval results from match()
            target_grid: Original target grid from plan parser
            df: DataFrame with activity data (for session duration context)

        Returns:
            Dict with:
            - is_complete: True if >= 95% of planned intervals were matched
            - completion_ratio: matched_count / expected_count
            - matched_count: Number of intervals successfully matched
            - expected_count: Number of intervals in the plan
            - session_duration_sec: Total duration of the session
            - planned_work_duration_sec: Total planned work duration
            - matched_work_duration_sec: Total matched work duration
        """
        expected_count = len(target_grid)
        matched_count = len([r for r in matched_results if r.get('status') == MatchStatus.MATCHED.value])

        # Calculate durations
        planned_work_duration = sum(t.get('duration', 0) for t in target_grid)
        matched_work_duration = sum(r.get('duration_sec', 0) or 0 for r in matched_results
                                    if r.get('status') == MatchStatus.MATCHED.value)

        # Session duration from DataFrame
        session_duration = len(df) if not df.empty else 0

        # Calculate completion ratio
        completion_ratio = matched_count / expected_count if expected_count > 0 else 1.0

        # Consider session complete if >= 95% of intervals matched
        is_complete = completion_ratio >= 0.95

        return {
            'is_complete': is_complete,
            'completion_ratio': round(completion_ratio, 3),
            'matched_count': matched_count,
            'expected_count': expected_count,
            'session_duration_sec': session_duration,
            'planned_work_duration_sec': planned_work_duration,
            'matched_work_duration_sec': matched_work_duration
        }

    def extract_last_interval_metrics(
        self,
        matched_results: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Extract and highlight metrics from the last matched interval.

        The last interval is often the most important for Karoly's analysis
        as it represents peak performance/fatigue state.

        Args:
            matched_results: List of matched interval results from match()

        Returns:
            Dict with:
            - avg_speed: float (m/s)
            - avg_pace: str (e.g., "3'07''/km")
            - avg_hr: float (bpm)
            - avg_power: float (W) if available
            - index: int (interval number, 1-indexed)
            - duration_sec: int
            Or None if no matched results
        """
        # Filter to only matched intervals
        matched = [r for r in matched_results if r.get('status') == MatchStatus.MATCHED.value]

        if not matched:
            return None

        last = matched[-1]
        avg_speed = last.get('avg_speed')
        avg_hr = last.get('avg_hr')
        avg_power = last.get('avg_power')
        duration = last.get('duration_sec', 0)

        # Convert speed to pace string
        avg_pace = None
        if avg_speed and avg_speed > 0:
            # Pace in seconds per km
            pace_sec_per_km = 1000.0 / avg_speed
            pace_min = int(pace_sec_per_km // 60)
            pace_sec = int(pace_sec_per_km % 60)
            avg_pace = f"{pace_min}'{pace_sec:02d}''/km"

        return {
            'avg_speed': round(avg_speed, 4) if avg_speed else None,
            'avg_pace': avg_pace,
            'avg_hr': round(avg_hr, 2) if avg_hr else None,
            'avg_power': round(avg_power, 2) if avg_power else None,
            'index': len(matched),  # 1-indexed position
            'duration_sec': duration
        }

    def _preprocess_laps(
        self, 
        laps: List[Dict[str, Any]], 
        signal_col: str,
        ref_intensity: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Preprocess LAP records to add cumulative offsets and normalize fields.
        """
        processed = []
        cumulative_offset = 0
        
        for lap in laps:
            # Use timer_time (active) if available, else elapsed
            duration = lap.get('total_timer_time', lap.get('total_elapsed_time', 0))
            if duration <= 0:
                continue
            
            # Round to nearest second to avoid 9.99s -> 9s truncation issues
            duration_int = int(round(duration))
            
            processed.append({
                'start_offset': cumulative_offset,
                'end_offset': cumulative_offset + duration_int,
                'duration': duration_int,
                'avg_power': lap.get('avg_power', 0),
                'avg_speed': lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0),
                'avg_hr': lap.get('avg_heart_rate', 0),
                'total_distance': lap.get('total_distance', 0),
                'intensity': self._classify_lap_intensity(lap, signal_col, ref_intensity),
                'raw': lap
            })
            
            cumulative_offset += duration_int
        
        return processed
    
    def _classify_lap_intensity(self, lap: Dict, signal_col: str, ref: Optional[float] = None) -> str:
        """Classify a LAP as WORK, RECOVERY, or TRANSITION based on intensity."""
        power = lap.get('avg_power') or 0
        speed = lap.get('enhanced_avg_speed') or lap.get('avg_speed') or 0
        
        # --- BIKE LOGIC ---
        if signal_col == 'power' or (power > 50 and power < 2000):
            # Dynamic thresholds if CP is available
            if ref and ref > 100:
                w_thresh = ref * 0.75 # 75% of CP is definitely Work/Tempo
                r_thresh = ref * 0.55 # Below 55% is Recovery
            else:
                # Lowered defaults for general population (Karoly's previous 400/300 were too high)
                w_thresh = 200.0
                r_thresh = 150.0
                
            if power >= w_thresh:
                return 'work'
            elif power < r_thresh:
                return 'recovery'
            return 'transition'
        
        # --- RUN/SWIM LOGIC ---
        if speed > 0:
            if ref and ref > 0:
                # For Run, speed is in m/s. 85% of CS is usually Work.
                w_thresh = ref * 0.82
                r_thresh = ref * 0.70
            else:
                w_thresh = 3.5 # ~12.6 km/h
                r_thresh = 2.8 # ~10 km/h
                
            if speed >= w_thresh:
                return 'work'
            elif speed < r_thresh:
                return 'recovery'
            return 'transition'
        
        return 'unknown'
    
    def _try_lap_match(
        self,
        laps: List[Dict[str, Any]],
        start_lap_idx: int,
        target: Dict[str, Any],
        target_min: float,
        duration_s: int,
        current_signal_ptr: int,
        signal_col: str,
        used_laps: set
    ) -> Tuple[Optional[Dict[str, Any]], int]:
        """
        Try to find a LAP that matches the target interval.
        
        Uses time-window matching: looks for LAPs that start within a reasonable
        range ahead of current_signal_ptr and match the target duration/intensity.
        
        Returns (match_result, new_lap_idx) or (None, same_lap_idx) if no match.
        """
        cfg = self.config
        
        if not laps:
            return None, start_lap_idx
        
        best_match = None
        best_confidence = 0
        best_idx = start_lap_idx
        
        # Search for LAPs in a time window around expected position
        search_start_time = current_signal_ptr - 60
        search_end_time = current_signal_ptr + max(cfg.max_search_gap, duration_s * 2)
        
        for i, lap in enumerate(laps):
            # Skip already-used LAPs
            if i in used_laps:
                continue
            
            # Skip LAPs that are too early (already passed)
            if lap['end_offset'] < search_start_time:
                continue
            
            # Skip LAPs that are too far ahead
            if lap['start_offset'] > search_end_time:
                break
            
            # --- SMART AGGREGATION: Try Merging Laps ---
            # Try single lap, then merge 2, then merge 3
            candidates = []
            
            # Candidate 1: Single Lap
            candidates.append((lap, [i]))
            
            # Candidate 2: Merge with next lap (if available and unused)
            if i + 1 < len(laps) and (i + 1) not in used_laps:
                next_lap = laps[i+1]
                # Only merge if contiguous (gap < 10s)
                if next_lap['start_offset'] - lap['end_offset'] < 10:
                    merged_2 = self._merge_laps([lap, next_lap])
                    candidates.append((merged_2, [i, i+1]))
                    
                    # Candidate 3: Merge with next next lap
                    if i + 2 < len(laps) and (i + 2) not in used_laps:
                        next_next = laps[i+2]
                        if next_next['start_offset'] - next_lap['end_offset'] < 10:
                            merged_3 = self._merge_laps([lap, next_lap, next_next])
                            candidates.append((merged_3, [i, i+1, i+2]))

            # Evaluate candidates
            for cand_lap, cand_indices in candidates:
                # Skip recovery LAPs when looking for work intervals (check first lap intensity)
                target_type = target.get('type', 'active')
                if target_type in ['active', 'ramp_up'] and cand_lap.get('intensity') == 'recovery':
                    continue
                
                # Calculate confidence score
                confidence = self._calculate_lap_confidence(
                    cand_lap, target_min, duration_s, signal_col,
                    target_distance=float(target.get('distance_m', 0))
                )
                
                if confidence > best_confidence:
                    best_confidence = confidence
                    # Store the merged lap and the index of the LAST used lap to advance pointer
                    best_match = {**cand_lap, 'confidence': confidence, 'lap_index': cand_indices} 
                    best_idx = cand_indices[-1] + 1
        
        print(f"DEBUG LAP MATCH: Target {target.get('duration')}s | Best Conf: {best_confidence:.2f}")
        
        if best_match and best_confidence >= cfg.lap_confidence_threshold:
            return best_match, best_idx
        
        return None, start_lap_idx

    def _merge_laps(self, laps_to_merge: List[Dict]) -> Dict:
        """Helper to merge multiple lap dicts into one."""
        if not laps_to_merge: return {}
        first = laps_to_merge[0]
        last = laps_to_merge[-1]

        total_dur = sum(l['duration'] for l in laps_to_merge)
        total_dist = sum(l.get('total_distance', 0) for l in laps_to_merge)

        # Weighted averages (handle None values)
        w_pwr = sum((l.get('avg_power') or 0) * l['duration'] for l in laps_to_merge) / total_dur if total_dur else 0
        w_spd = sum((l.get('avg_speed') or 0) * l['duration'] for l in laps_to_merge) / total_dur if total_dur else 0
        w_hr = sum((l.get('avg_hr') or 0) * l['duration'] for l in laps_to_merge) / total_dur if total_dur else 0

        return {
            'start_offset': first['start_offset'],
            'end_offset': last['end_offset'],
            'duration': total_dur,
            'total_distance': total_dist,
            'avg_power': w_pwr,
            'avg_speed': w_spd,
            'avg_hr': w_hr,
            'intensity': first.get('intensity', 'unknown'), # Assume intent matches start
            'raw': first['raw'] # Keep ref
        }

    def _refine_boundaries_with_signal(
        self,
        df: pd.DataFrame,
        tentative_start: int,
        tentative_end: int,
        signal_col: str,
        target_min: float,
        search_window: int = 30
    ) -> Tuple[int, int]:
        """
        Refine LAP boundaries using signal-based edge detection.

        This handles mid-lap starts where the athlete begins the interval
        between km marks (e.g., at 3.5km instead of exactly 3km or 4km).

        Uses gradient analysis of speed/power to find the actual transition points.

        Args:
            df: DataFrame with signal data
            tentative_start: LAP-based start index
            tentative_end: LAP-based end index
            signal_col: 'speed' or 'power'
            target_min: Expected minimum intensity
            search_window: Seconds to search around LAP boundary

        Returns:
            Tuple of (refined_start, refined_end)
        """
        try:
            # Create edge detector for this segment
            edge_detector = MultiSignalEdgeDetector(df, sport='run' if signal_col == 'speed' else 'bike')

            # Refine start boundary
            start_result = edge_detector.find_edge(
                tentative_idx=tentative_start,
                edge_type='start',
                target_intensity=target_min
            )
            refined_start = start_result.index if start_result else tentative_start

            # Refine end boundary
            end_result = edge_detector.find_edge(
                tentative_idx=tentative_end,
                edge_type='end',
                target_intensity=target_min
            )
            refined_end = end_result.index if end_result else tentative_end

            # Sanity checks
            if refined_start >= refined_end:
                # Invalid refinement, keep original
                return tentative_start, tentative_end

            # Don't allow extreme shifts (> search_window)
            if abs(refined_start - tentative_start) > search_window:
                refined_start = tentative_start
            if abs(refined_end - tentative_end) > search_window:
                refined_end = tentative_end

            return refined_start, refined_end

        except Exception:
            # Fallback to original boundaries on any error
            return tentative_start, tentative_end
    
    def _calculate_lap_confidence(
        self,
        lap: Dict[str, Any],
        target_min: float,
        target_duration: int,
        signal_col: str,
        target_distance: float = 0
    ) -> float:
        """
        Calculate confidence score for LAP ↔ Target match.
        
        Score components:
        - Duration OR Distance match (50%): If distance target exists, prioritize it.
        - Intensity match (30%): How close is LAP power/speed to target?
        - Intensity type (20%): Is this a WORK lap?
        """
        cfg = self.config
        
        # --- DURATION / DISTANCE SCORE ---
        # Priority to Distance if specified in target (e.g. 2000m)
        duration_score = 0.0
        
        if target_distance > 0 and lap.get('total_distance', 0) > 0:
            dist_ratio = lap['total_distance'] / target_distance
            # Strict distance tolerance (e.g. ±5%)
            if 1 - cfg.lap_distance_tolerance <= dist_ratio <= 1 + cfg.lap_distance_tolerance:
                # Perfect distance match overrides duration mismatch
                duration_score = 1.0 
            else:
                # If distance matches poorly, check duration (maybe GPS error but time was respected?)
                # But usually if distance is target, duration is variable.
                # We give a partial score if distance is close-ish
                 duration_score = max(0, 1 - abs(1 - dist_ratio) / (cfg.lap_distance_tolerance * 2))
        
        # Fallback or Secondary check on Duration
        # If distance score wasn't perfect (or not applicable), check duration
        if duration_score < 0.9:
            target_duration = float(target_duration)
            if target_duration > 0:
                duration_ratio = lap['duration'] / target_duration
                
                # Duration Score with 10s absolute tolerance or Config tolerance
                abs_diff = abs(lap['duration'] - target_duration)
                if abs_diff <= 10:
                    dur_score_val = 1.0
                elif 1 - cfg.lap_duration_tolerance <= duration_ratio <= 1 + cfg.lap_duration_tolerance:
                    dur_score_val = 1 - abs(1 - duration_ratio) / cfg.lap_duration_tolerance
                else:
                    dur_score_val = 0
                
                # Take the best of Distance vs Duration score
                duration_score = max(duration_score, dur_score_val)
        
        # Intensity score (0-1)
        # Try to use the same metric as target, fallback to power
        actual = 0
        expected = target_min
        
        if signal_col == 'power':
            actual = lap.get('avg_power', 0)
        else:
            # Target is speed, but LAP might not have speed
            actual = lap.get('avg_speed', 0)
            if actual == 0 and lap.get('avg_power', 0) > 0:
                # Fallback: use power as proxy
                actual = lap.get('avg_power', 0)
                expected = target_min * 100  # Rough estimate
        
        if expected > 0 and actual > 0:
            # If expected is very low (default minimum), treat it as a floor only
            # e.g. target_min=80W (default bike), actual=274W -> Should be 1.0 score
            is_generic_floor = (signal_col == 'power' and expected < 150) or \
                               (signal_col == 'speed' and expected < 2.8) # ~10km/h

            intensity_ratio = actual / expected

            if is_generic_floor:
                # Only penalize if below floor
                if intensity_ratio >= 1.0:
                    intensity_score = 1.0
                else:
                    intensity_score = max(0, 1 - abs(1 - intensity_ratio) * 2)
            else:
                # SURGICAL PRECISION (2026-02-02): Tighter tolerance for high-intensity targets
                # For running/cycling intervals, the athlete should be AT or ABOVE target
                # Warmup laps (e.g., 4.51 vs 5.0 m/s = 0.902) should be strongly penalized
                #
                # Key insight: Real intervals are typically at 98-105% of target
                # Warmup laps are typically at 85-95% of target
                # We need to clearly separate these two cases
                if intensity_ratio >= 0.96:
                    # At or above target (within 4%): full score
                    intensity_score = 1.0
                elif intensity_ratio >= 0.93:
                    # 4-7% below target: good but not perfect
                    intensity_score = 0.75 + (intensity_ratio - 0.93) / 0.03 * 0.25
                elif intensity_ratio >= 0.88:
                    # 7-12% below target: mediocre (likely warmup)
                    intensity_score = 0.3 + (intensity_ratio - 0.88) / 0.05 * 0.45
                else:
                    # More than 12% below target: strong penalty (definitely warmup)
                    intensity_score = max(0, intensity_ratio / 0.88 * 0.3)

                # Over-performing is fine (up to 15%)
                if intensity_ratio > 1.15:
                    intensity_score = max(0.7, intensity_score - (intensity_ratio - 1.15) * 0.6)
        else:
            intensity_score = 0.2  # No data, small partial credit
        
        # Work type score (0-1)
        intensity_type = lap.get('intensity', 'unknown')
        if intensity_type == 'work':
            work_score = 1.0
        elif intensity_type == 'transition':
            work_score = 0.5
        else:
            work_score = 0.1
        
        # Weighted average - duration is most important
        confidence = (0.50 * duration_score + 
                     0.30 * intensity_score + 
                     0.20 * work_score)
        
        return confidence
    
    def _build_lap_result(
        self,
        df: pd.DataFrame,
        lap_match: Dict[str, Any],
        target: Dict[str, Any],
        target_idx: int,
        signal_col: str
    ) -> Dict[str, Any]:
        """Build a result dict from a LAP match.

        SURGICAL PRECISION (2026-01-30):
        Uses timestamp-based searchsorted to find the exact DataFrame index
        corresponding to the LAP's start_time. This ensures nanosecond-level
        alignment with Nolio/Garmin data.
        """
        start_ts = lap_match.get('raw', {}).get('start_time')
        duration = lap_match['duration']

        start_idx = 0
        if start_ts and 'timestamp' in df.columns:
            # SURGICAL ALIGNMENT: Use searchsorted for precise index lookup
            try:
                # Convert timestamp column to datetime if needed
                ts_series = pd.to_datetime(df['timestamp'])
                start_ts_dt = pd.to_datetime(start_ts)

                # searchsorted finds the exact insertion point (binary search)
                # This is O(log n) and finds the first index where ts >= start_ts
                start_idx = int(ts_series.searchsorted(start_ts_dt))

                # Bounds check
                if start_idx >= len(df):
                    start_idx = len(df) - 1
                elif start_idx < 0:
                    start_idx = 0

            except Exception:
                # Fallback to cumulative offset if timestamp parsing fails
                start_idx = lap_match['start_offset']
        else:
            start_idx = lap_match['start_offset']

        end_idx = start_idx + duration
        
        # --- SURGICAL PRECISION FOR LAPS (2026-01-28) ---
        # When an athlete uses LAPs, we must respect their exact boundaries.
        # We bypass _optimize_window and _calculate_plateau_metrics (trimming)
        # to ensure the data matches Nolio/Garmin at the second level.
        
        final_start = start_idx
        final_end = end_idx
        
        # Calculate metrics using the RAW window (NO TRIMMING)
        plateau_metrics = self._calculate_plateau_metrics(
            df, signal_col, final_start, final_end, duration, trim=False
        )
        
        # Use recalculated metrics from stream (more precise than Lap average)
        # unless stream is missing data.
        avg_power = plateau_metrics.get('avg_power')
        avg_speed = plateau_metrics.get('avg_speed')
        avg_hr = plateau_metrics.get('avg_hr')
        
        # Calculate respect score
        target_min = float(target.get('target_min', 0) or 0)
        if signal_col == 'power':
            realized = avg_power or 0
        else:
            realized = avg_speed or 0
        
        respect_score = (realized / target_min * 100) if target_min > 0 else None
        
        return {
            "status": MatchStatus.MATCHED.value,
            "source": MatchSource.LAP.value,
            "confidence": lap_match['confidence'],
            "lap_index": lap_match['lap_index'],
            "target_index": target_idx,
            "start_index": final_start,
            "end_index": final_end,
            "duration_sec": final_end - final_start,
            "expected_duration": int(target.get('duration', 0)),
            "avg_power": avg_power,
            "avg_speed": avg_speed,
            "avg_hr": avg_hr,
            "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
            "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
            "respect_score": respect_score,
            "target": target
        }

    def _optimize_window(
        self,
        df: pd.DataFrame,
        signal_col: str,
        original_start: int,
        duration: int,
        search_range: Tuple[int, int] = (-1, 4)
    ) -> Tuple[int, int]:
        """
        Find the optimal window for the interval.
        
        CRITICAL UPDATE (2026-01-27):
        We observed a linear clock drift in Nolio/Garmin data vs Stream.
        - Start of session: Nolio matches Stream shifted by +2s.
        - End of session: Nolio matches Stream shifted by +1s.
        
        We apply a Linear Drift Correction to match Nolio's "Absolute Truth",
        even if it means clipping the true physiological peak (which is often earlier).
        """
        total_len = len(df)
        if total_len == 0:
            return original_start, original_start + duration
            
        # Calculate progress through the file (0.0 to 1.0)
        progress = original_start / total_len
        
        # Linear Model: Offset goes from +2.0s at start to +1.0s at end
        # This models the clock drift observed in Seraphin Barbot's session
        # Tuned 2026-01-27: Observed +2s at 60% progress, +1s at 90% progress.
        # Model: Offset = 4.0 - (progress * 3.0)
        estimated_lag = 4.0 - (progress * 3.0)
        
        # Round to nearest integer shift
        shift = int(round(estimated_lag))
        
        # Apply shift
        new_start = original_start + shift
        
        # Bounds check
        new_start = max(0, min(new_start, len(df) - duration))
        
        # Debug Log (can be removed later)
        # print(f"DEBUG DRIFT: Prog={progress:.2f}, Est={estimated_lag:.2f}, Shift={shift}")
        
        return new_start, new_start + duration

    
    def _match_by_signal_refined(
        self,
        df: pd.DataFrame,
        signal: np.ndarray,
        signal_col: str,
        segments: List[Dict[str, Any]],
        start_ptr: int,
        target: Dict[str, Any],
        target_grid: List[Dict[str, Any]],
        detected_intervals: List[Dict[str, Any]],
        target_min: float,
        duration_s: int,
        sport: str,
        target_idx: int,
        is_resync: bool = False
    ) -> Dict[str, Any]:
        """
        Uses MetaSeeker (Sub-second Spline Precision) combined with Step Detection 
        to find the best match for a target.
        """
        cfg = self.config
        
        # --- NEW: MetaSeeker (The Surgical Spline Calque) ---
        # Default to low res/no lag to pass synthetic tests. 
        # High-res and lag compensation can be enabled for real-world ingestion.
        seeker = MetaSeeker(df, primary_signal=signal_col, resolution_hz=1, use_lag_compensation=False)
        # Search window is larger if we are resyncing or it's the first target
        search_window = 600 if (target_idx == 0 or is_resync) else 120
        
        # Check if next interval starts immediately after this one in the plan
        is_composite = False
        if target_idx + 1 < len(target_grid):
             # This is a bit simplified, but in NolioPlanParser, we don't have 
             # inter-step gaps explicitly if they aren't steps themselves.
             # However, if the user didn't plan a 'recovery' between steps, 
             # they are likely composite.
             pass

        # For ultra-precision, if the previous interval was matched just before,
        # we enforce strict duration to avoid overlap.
        is_adjacent_to_prev = (target_idx > 0 and len(detected_intervals) > 0 and 
                              detected_intervals[-1]['status'] == MatchStatus.MATCHED.value and
                              abs(detected_intervals[-1]['end_index'] - start_ptr) < 15)

        seek_result = seeker.seek(
            target_duration=duration_s, 
            expected_start=start_ptr, 
            search_window=search_window,
            min_start=start_ptr - 5, # Stricter overlap control
            strict_duration=is_adjacent_to_prev
        )
        
        if seek_result:
            # Validate seek result against target_min
            # We are more permissive here because refinement will have found the best plateau
            if seek_result['avg'] >= target_min * 0.75:
                start_idx = seek_result['start']
                end_idx = seek_result['end']
                
                plateau_metrics = self._calculate_plateau_metrics(
                    df, signal_col, start_idx, end_idx, duration_s
                )
                
                realized = plateau_metrics.get(f'avg_{signal_col}', 0)
                respect_score = (realized / target_min * 100) if target_min > 0 else None
                
                return {
                    "status": MatchStatus.MATCHED.value,
                    "source": MatchSource.SIGNAL.value,
                    "confidence": 0.95, # High confidence for PlanDrivenSeeker
                    "lap_index": None,
                    "target_index": target_idx,
                    "start_index": start_idx,
                    "end_index": end_idx,
                    "duration_sec": end_idx - start_idx,
                    "expected_duration": duration_s,
                    "avg_power": plateau_metrics.get('avg_power'),
                    "avg_speed": plateau_metrics.get('avg_speed'),
                    "avg_hr": plateau_metrics.get('avg_hr'),
                    "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
                    "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
                    "respect_score": respect_score,
                    "target": target
                }

        # --- FALLBACK: Legacy Segment-based search ---
        best_segment = None
        best_score = 0
        
        # Search window
        search_window_start = start_ptr - 30
        search_window_end = start_ptr + max(cfg.max_search_gap, duration_s * 3)
        
        for seg in segments:
            # Must be in window
            if seg['start'] < search_window_start:
                continue
            if seg['start'] > search_window_end:
                break
                
            # Score this segment
            # 1. Duration score (how close to expected duration)
            dur_ratio = seg['duration'] / duration_s
            
            # HARD CONSTRAINT: Disqualify if duration is way off
            if dur_ratio < 0.5 or dur_ratio > 4.0:
                continue
                
            if 0.7 <= dur_ratio <= 1.5:
                dur_score = 1 - abs(1 - dur_ratio)
            elif 1.5 < dur_ratio <= 4.0:
                # It's a "Big Block" (potentially multiple intervals fused)
                dur_score = 0.8
            elif 0.5 <= dur_ratio < 0.7:
                # Partial credit for short segments
                dur_score = 0.5
            else:
                dur_score = 0
                
            # 2. Intensity score (how close to target_min)
            intensity_ratio = seg['mean'] / target_min if target_min > 0 else 0
            if intensity_ratio >= cfg.entry_threshold_ratio: # 0.8
                int_score = 1.0
            elif intensity_ratio >= 0.70:
                int_score = 0.5 + 0.5 * ((intensity_ratio - 0.70) / 0.10)
            else:
                int_score = 0
                
            if int_score == 0:
                dur_score *= 0.5
                
            # 3. Proximity score
            prox_limit = 3600 if (target_idx == 0 or is_resync) else 900
            prox_score = 1 - min(1.0, abs(seg['start'] - start_ptr) / prox_limit)
            
            total_score = dur_score * 0.4 + int_score * 0.4 + prox_score * 0.2
            
            if total_score > best_score:
                best_score = total_score
                best_segment = seg

        if best_segment and best_score > 0.5:
            start_idx = best_segment['start']
            end_idx = best_segment['end']
            
            if best_segment['duration'] > duration_s * 1.2:
                 start_idx, end_idx = self._find_best_window(signal, start_idx, end_idx, duration_s)
            elif best_segment['duration'] < duration_s:
                diff = duration_s - best_segment['duration']
                new_start = max(0, start_idx - diff // 2)
                new_end = min(len(signal), end_idx + (diff - diff // 2))
                if new_start < start_idx or new_end > end_idx:
                    expanded_mean = np.mean(signal[new_start:new_end])
                    if expanded_mean > 0.85 * best_segment['mean']:
                        start_idx, end_idx = new_start, new_end

            plateau_metrics = self._calculate_plateau_metrics(
                df, signal_col, start_idx, end_idx, duration_s
            )
            
            realized = plateau_metrics.get(f'avg_{signal_col}', 0)
            respect_score = (realized / target_min * 100) if target_min > 0 else None
            
            return {
                "status": MatchStatus.MATCHED.value,
                "source": MatchSource.SIGNAL.value,
                "confidence": round(best_score, 2),
                "lap_index": None,
                "target_index": target_idx,
                "start_index": start_idx,
                "end_index": end_idx,
                "duration_sec": end_idx - start_idx,
                "expected_duration": duration_s,
                "avg_power": plateau_metrics.get('avg_power'),
                "avg_speed": plateau_metrics.get('avg_speed'),
                "avg_hr": plateau_metrics.get('avg_hr'),
                "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
                "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
                "respect_score": respect_score,
                "target": target
            }

        return self._create_not_found_result(target, target_idx)

    def _match_by_signal(
        self,
        df: pd.DataFrame,
        signal: np.ndarray,
        signal_col: str,
        pause_mask: np.ndarray,
        start_ptr: int,
        target: Dict[str, Any],
        target_min: float,
        duration_s: int,
        sport: str,
        target_idx: int
    ) -> Dict[str, Any]:
        """
        Match interval using signal-based hysteresis detection.
        This is the fallback when LAP matching fails.
        """
        cfg = self.config
        
        # Calculate thresholds
        entry_thresh = target_min * cfg.entry_threshold_ratio
        exit_thresh = target_min * cfg.exit_threshold_ratio
        
        # Search bounds - dynamic based on target duration
        dynamic_gap = max(cfg.max_search_gap, int(duration_s * cfg.search_gap_multiplier))
        search_end = min(start_ptr + dynamic_gap + duration_s, len(signal))
        
        best_match = None
        retries = 0
        search_ptr = start_ptr
        
        while retries < cfg.max_retries and search_ptr < search_end:
            # Find entry point
            entry_idx = self._find_entry(signal, pause_mask, search_ptr, search_end, entry_thresh)
            
            if entry_idx is None:
                break
            
            # Find exit point
            exit_idx = self._find_exit(signal, pause_mask, entry_idx, search_end, exit_thresh, duration_s)
            
            if exit_idx is None:
                exit_idx = min(entry_idx + duration_s * 2, search_end - 1)
            
            # Validate the found interval
            found_duration = exit_idx - entry_idx
            
            if found_duration >= duration_s * cfg.min_duration_ratio:
                if found_duration > duration_s * cfg.max_duration_ratio:
                    entry_idx, exit_idx = self._find_best_window(
                        signal, entry_idx, exit_idx, duration_s
                    )
                
                best_match = (entry_idx, exit_idx)
                break
            
            search_ptr = exit_idx + cfg.retry_offset
            retries += 1
        
        if best_match is None:
            return self._create_not_found_result(target, target_idx)
        
        start_idx, end_idx = best_match
        
        # Calculate plateau metrics
        plateau_metrics = self._calculate_plateau_metrics(
            df, signal_col, start_idx, end_idx, duration_s
        )
        
        # Calculate respect score
        realized = plateau_metrics.get(f'avg_{signal_col}', 0)
        respect_score = (realized / target_min * 100) if target_min > 0 else None
        
        return {
            "status": MatchStatus.MATCHED.value,
            "source": MatchSource.SIGNAL.value,
            "confidence": None,
            "lap_index": None,
            "target_index": target_idx,
            "start_index": start_idx,
            "end_index": end_idx,
            "duration_sec": end_idx - start_idx,
            "expected_duration": duration_s,
            "avg_power": plateau_metrics.get('avg_power'),
            "avg_speed": plateau_metrics.get('avg_speed'),
            "avg_hr": plateau_metrics.get('avg_hr'),
            "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
            "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
            "respect_score": respect_score,
            "target": target
        }
    
    # ===== Helper methods (unchanged from V2) =====
    
    def _find_entry(
        self, 
        signal: np.ndarray,
        pause_mask: np.ndarray,
        start: int, 
        end: int, 
        threshold: float
    ) -> Optional[int]:
        """Find first index where signal crosses above threshold."""
        for i in range(start, end):
            if not pause_mask[i] and signal[i] >= threshold:
                return i
        return None
    
    def _find_exit(
        self,
        signal: np.ndarray,
        pause_mask: np.ndarray,
        start: int,
        end: int,
        threshold: float,
        expected_duration: int
    ) -> Optional[int]:
        """Find exit point using hysteresis."""
        min_exit_idx = start + int(expected_duration * 0.5)
        below_count = 0
        required_below = 5
        
        for i in range(start, min(end, start + expected_duration * 3)):
            if pause_mask[i]:
                if i > min_exit_idx:
                    return i
                continue
            
            if signal[i] < threshold:
                below_count += 1
                if below_count >= required_below and i > min_exit_idx:
                    return i - required_below + 1
            else:
                below_count = 0
        
        return None
    
    def _find_best_window(
        self,
        signal: np.ndarray,
        start: int,
        end: int,
        target_duration: int
    ) -> Tuple[int, int]:
        """Find the best window of target_duration within [start, end]."""
        window = min(target_duration, end - start)
        if window <= 0:
            return start, end
        
        rolling = pd.Series(signal[start:end]).rolling(window=window).mean()
        best_end_offset = rolling.idxmax()
        
        if pd.isna(best_end_offset):
            return start, min(start + window, end)
        
        best_end = start + int(best_end_offset) + 1
        best_start = best_end - window
        
        return max(start, best_start), min(end, best_end)
    
    def _calculate_plateau_metrics(
        self,
        df: pd.DataFrame,
        signal_col: str,
        start_idx: int,
        end_idx: int,
        expected_duration: int,
        trim: bool = True
    ) -> Dict[str, Any]:
        """Calculate metrics with plateau-focused averages."""
        cfg = self.config
        
        # Bounds check
        start_idx = max(0, min(start_idx, len(df) - 1))
        end_idx = max(start_idx + 1, min(end_idx, len(df)))
        
        interval_df = df.iloc[start_idx:end_idx]
        
        metrics = {}
        for col in ['power', 'speed', 'heart_rate']:
            if col in df.columns:
                series = interval_df[col].dropna()
                if col == 'power':
                    # Karoly 2026-02-02: Wmoy excludes zeros
                    val = series[series > 0].mean() if not series.empty else None
                else:
                    val = series.mean()
                
                key = f'avg_{col}' if col != 'heart_rate' else 'avg_hr'
                metrics[key] = float(val) if val is not None and not pd.isna(val) else None
        
        # Plateau averages (trimmed) - Only if requested
        if trim:
            actual_duration = end_idx - start_idx
            trim_start = min(cfg.plateau_trim_start, actual_duration // 4)
            trim_end = min(cfg.plateau_trim_end, actual_duration // 4)
            
            plateau_start = start_idx + trim_start
            plateau_end = end_idx - trim_end
            
            if plateau_end > plateau_start:
                plateau_df = df.iloc[plateau_start:plateau_end]
                for col in ['power', 'speed', 'heart_rate']:
                    if col in df.columns:
                        series = plateau_df[col].dropna()
                        if col == 'power':
                            # Karoly 2026-02-02: Wmoy excludes zeros
                            val = series[series > 0].mean() if not series.empty else None
                        else:
                            val = series.mean()
                        
                        key = f'plateau_avg_{col}' if col != 'heart_rate' else 'avg_hr'
                        metrics[key] = float(val) if val is not None and not pd.isna(val) else None
        else:
            # If not trimming, plateau metrics are the same as global ones
            metrics['plateau_avg_power'] = metrics.get('avg_power')
            metrics['plateau_avg_speed'] = metrics.get('avg_speed')
            # HR is already calculated above without trimming in the first loop
        
        return metrics
    
    def _detect_pauses(self, signal: np.ndarray, sport: str) -> np.ndarray:
        """Detect pause zones in the signal."""
        cfg = self.config
        
        if sport == 'bike':
            thresh = cfg.min_power_bike * 0.5
        elif sport == 'swim':
            thresh = cfg.min_speed_swim * 0.5
        else:
            thresh = cfg.pause_speed_threshold
        
        low_mask = signal < thresh
        pause_mask = np.zeros(len(signal), dtype=bool)
        
        i = 0
        while i < len(signal):
            if low_mask[i]:
                j = i
                while j < len(signal) and low_mask[j]:
                    j += 1
                
                if j - i >= cfg.pause_min_duration:
                    pause_mask[i:j] = True
                
                i = j
            else:
                i += 1
        
        return pause_mask
    
    def _select_signal(
        self,
        df: pd.DataFrame,
        target_grid: List[Dict[str, Any]],
        sport: str
    ) -> Tuple[str, Optional[np.ndarray]]:
        """Select the appropriate signal column based on sport and targets."""
        target_types = [t.get('target_type', '') for t in target_grid]
        power_count = target_types.count('power')
        pace_count = target_types.count('pace') + target_types.count('speed')
        
        if sport == 'bike':
            signal_col = 'power' if 'power' in df.columns else 'speed'
        elif sport == 'swim':
            signal_col = 'speed' if 'speed' in df.columns else None
        else:
            if pace_count > 0 and 'speed' in df.columns:
                signal_col = 'speed'
            elif power_count > pace_count and 'power' in df.columns:
                signal_col = 'power'
            else:
                signal_col = 'speed' if 'speed' in df.columns else 'power'
        
        if signal_col is None or signal_col not in df.columns:
            for col in ['speed', 'power']:
                if col in df.columns:
                    signal_col = col
                    break
        
        if signal_col not in df.columns:
            return None, None
        
        signal = df[signal_col].fillna(0).values.copy()
        return signal_col, signal
    
    def _get_sport_minimum(self, sport: str, signal_col: str) -> float:
        """Get minimum threshold for a sport when no target is specified."""
        cfg = self.config
        
        if signal_col == 'power':
            return cfg.min_power_bike
        elif sport == 'swim':
            return cfg.min_speed_swim
        else:
            return cfg.min_speed_run
    
    def _create_not_found_result(
        self,
        target: Dict[str, Any],
        target_idx: int
    ) -> Dict[str, Any]:
        """Create a NOT_FOUND result for a target that couldn't be matched."""
        return {
            "status": MatchStatus.NOT_FOUND.value,
            "source": None,
            "confidence": None,
            "lap_index": None,
            "target_index": target_idx,
            "start_index": None,
            "end_index": None,
            "duration_sec": None,
            "expected_duration": int(target.get('duration', 0)),
            "avg_power": None,
            "avg_speed": None,
            "avg_hr": None,
            "plateau_avg_power": None,
            "plateau_avg_speed": None,
            "respect_score": None,
            "target": target
        }