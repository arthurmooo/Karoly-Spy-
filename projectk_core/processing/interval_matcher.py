"""
Interval Matcher V3 - Hybrid LAP + Signal Detection

This module provides surgical alignment of planned intervals (Target Grid)
with actual data streams from FIT files, using a hybrid approach:
1. First, try to match using LAP data (if athlete marked intervals correctly)
2. Fall back to signal-based detection if LAPs don't match the plan

Key Features:
- LAP-first matching with confidence scoring
- Hysteresis-based signal detection as fallback
- Plateau centering for accurate metrics
- Source traceability (lap vs signal)

Author: Project K Team
Version: 3.0.0
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from projectk_core.logic.step_detector import StepDetector


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
    lap_intensity_tolerance: float = 0.35    # ±35% power/speed tolerance
    lap_confidence_threshold: float = 0.70   # Min confidence to use LAP
    
    # Thresholds for hysteresis (signal fallback)
    entry_threshold_ratio: float = 0.80      # 80% of target to enter
    exit_threshold_ratio: float = 0.65       # 65% of target to exit
    
    # Plateau trimming (seconds)
    plateau_trim_start: int = 8              # Seconds to trim at start
    plateau_trim_end: int = 5                # Seconds to trim at end
    
    # Match validation
    min_duration_ratio: float = 0.70         # Must find at least 70% of target duration
    max_duration_ratio: float = 1.50         # Don't accept more than 150% of target
    
    # Pause detection
    pause_speed_threshold: float = 1.5       # m/s - below this = walking/stopped
    pause_min_duration: int = 20             # Seconds - minimum to consider a pause
    
    # Search behavior
    max_search_gap: int = 900                # Max seconds to search ahead
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
        laps: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Main entry point: Match target intervals to actual data.
        
        Args:
            df: DataFrame with 1Hz data (timestamp, speed, power, heart_rate, distance)
            target_grid: List of target intervals from plan_parser
            sport: Sport type ('run', 'bike', 'swim')
            laps: Optional list of LAP records from FIT file
            
        Returns:
            List of detected intervals with metrics, status, and source
        """
        if df.empty or not target_grid:
            return []
        
        # 1. Select signal source based on sport and available data
        signal_col, signal = self._select_signal(df, target_grid, sport)
        if signal is None:
            return []
        
        # 2. Pre-detect all intensity segments (Step Detection)
        # Use sport-specific min_delta
        min_delta = 10.0 if signal_col == 'power' else 0.2
        self.detector.min_delta = min_delta
        
        detected_steps = self.detector.detect_steps(signal)
        signal_segments = self.detector.segment_by_steps(signal, detected_steps)
        
        # 3. Preprocess LAPs if available
        processed_laps = self._preprocess_laps(laps, signal_col) if laps else []
        
        # 4. Detect pause zones
        pause_mask = self._detect_pauses(signal, sport)
        
        # 5. Filter LAPs to only WORK laps with meaningful duration (>20s)
        work_laps = [l for l in processed_laps 
                     if l.get('intensity') == 'work' and l.get('duration', 0) >= 20]
        
        # 6. Simple sequential matching: consume LAPs in order, fallback to signal
        detected_intervals = []
        lap_idx = 0      # Index into work_laps
        current_ptr = 0  # Current position in signal for fallback
        
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
            search_limit = min(lap_idx + 5, len(work_laps))
            
            for i in range(lap_idx, search_limit):
                lap = work_laps[i]
                confidence = self._calculate_lap_confidence(
                    lap, target_min, duration_s, signal_col
                )
                if confidence >= self.config.lap_confidence_threshold:
                    matched_lap = {**lap, 'lap_index': i, 'confidence': confidence}
                    matched_idx = i
                    break
            
            if matched_lap:
                result = self._build_lap_result(
                    df, matched_lap, target, target_idx, signal_col
                )
                detected_intervals.append(result)
                lap_idx = matched_idx + 1
                current_ptr = result['end_index'] + 5 # Sync pointer
            else:
                # No matching LAP - fall back to Step Detection + Correlation
                result = self._match_by_signal_refined(
                    df=df,
                    signal=signal,
                    signal_col=signal_col,
                    segments=signal_segments,
                    start_ptr=current_ptr,
                    target=target,
                    target_min=target_min,
                    duration_s=duration_s,
                    sport=sport,
                    target_idx=target_idx,
                    is_resync=(target_idx > 0 and len(detected_intervals) > 0 and detected_intervals[-1]['status'] == MatchStatus.NOT_FOUND.value)
                )
                detected_intervals.append(result)
                
                # Advance pointer based on result
                if result['status'] == MatchStatus.MATCHED.value:
                    current_ptr = result['end_index'] + 5
                else:
                    # SMART RESYNC: If target not found, the sequence might be broken.
                    # We look ahead for the NEXT target to see if we can find it.
                    # This allows skipping an interval the athlete didn't do.
                    current_ptr += duration_s // 2 # Small advance to avoid loop
                    
                    # If we've missed 2 targets in a row, we allow a wider search for the next one
                    # (This is implicitly handled by prox_limit being large for fallback search)
                    pass
        
        return detected_intervals
    
    def _preprocess_laps(
        self, 
        laps: List[Dict[str, Any]], 
        signal_col: str
    ) -> List[Dict[str, Any]]:
        """
        Preprocess LAP records to add cumulative offsets and normalize fields.
        """
        processed = []
        cumulative_offset = 0
        
        for lap in laps:
            duration = lap.get('total_elapsed_time', 0)
            if duration <= 0:
                continue
            
            processed.append({
                'start_offset': cumulative_offset,
                'end_offset': cumulative_offset + int(duration),
                'duration': int(duration),
                'avg_power': lap.get('avg_power', 0),
                'avg_speed': lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0),
                'avg_hr': lap.get('avg_heart_rate', 0),
                'total_distance': lap.get('total_distance', 0),
                'intensity': self._classify_lap_intensity(lap, signal_col),
                'raw': lap
            })
            
            cumulative_offset += int(duration)
        
        return processed
    
    def _classify_lap_intensity(self, lap: Dict, signal_col: str) -> str:
        """Classify a LAP as WORK, RECOVERY, or TRANSITION based on intensity."""
        power = lap.get('avg_power') or 0
        speed = lap.get('enhanced_avg_speed') or lap.get('avg_speed') or 0
        
        # Always check power first since it's more reliable in FIT files
        if power > 0:
            if power > 400:  # Lowered from 450 to capture strong tempo
                return 'work'
            elif power < 300: # Lowered from 350
                return 'recovery'
            return 'transition'
        
        # Fallback to speed if power is not available
        if speed > 0:
            if speed > 4.0: # Lowered from 4.5
                return 'work'
            elif speed < 3.0:
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
            
            # Skip recovery LAPs when looking for work intervals
            target_type = target.get('type', 'active')
            if target_type in ['active', 'ramp_up'] and lap.get('intensity') == 'recovery':
                continue
            
            # Calculate confidence score
            confidence = self._calculate_lap_confidence(
                lap, target_min, duration_s, signal_col
            )
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = {**lap, 'confidence': confidence, 'lap_index': i}
                best_idx = i + 1
        
        print(f"DEBUG LAP MATCH: Target {target.get('duration')}s | Best Conf: {best_confidence:.2f}")
        
        if best_match and best_confidence >= cfg.lap_confidence_threshold:
            return best_match, best_idx
        
        return None, start_lap_idx
    
    def _calculate_lap_confidence(
        self,
        lap: Dict[str, Any],
        target_min: float,
        target_duration: int,
        signal_col: str
    ) -> float:
        """
        Calculate confidence score for LAP ↔ Target match.
        
        Score components:
        - Duration match (50%): How close is LAP duration to target?
        - Intensity match (30%): How close is LAP power/speed to target?
        - Intensity type (20%): Is this a WORK lap?
        """
        cfg = self.config
        
        target_duration = float(target_duration)
        duration_ratio = lap['duration'] / target_duration if target_duration > 0 else 0
        
        # Duration Score with 10s absolute tolerance or Config tolerance
        abs_diff = abs(lap['duration'] - target_duration)
        if abs_diff <= 10:
            duration_score = 1.0
        elif 1 - cfg.lap_duration_tolerance <= duration_ratio <= 1 + cfg.lap_duration_tolerance:
            duration_score = 1 - abs(1 - duration_ratio) / cfg.lap_duration_tolerance
        else:
            duration_score = 0
        
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
                # Standard bracket
                if 0.70 <= intensity_ratio <= 1.30:  # Wider tolerance for proxy
                    intensity_score = 1 - abs(1 - intensity_ratio) / 0.30
                else:
                    # Allow harder efforts (up to 2x) but penalize weaker efforts
                    if intensity_ratio > 1.30 and intensity_ratio < 2.0:
                        intensity_score = 0.8
                    else:
                        intensity_score = max(0, 0.3 - abs(1 - intensity_ratio) / 3)
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
        """Build a result dict from a LAP match."""
        start_idx = lap_match['start_offset']
        end_idx = lap_match['end_offset']
        
        # Calculate metrics from the actual signal data using LAP boundaries
        plateau_metrics = self._calculate_plateau_metrics(
            df, signal_col, start_idx, end_idx, lap_match['duration']
        )
        
        # Use LAP averages as primary (more accurate from device)
        avg_power = lap_match.get('avg_power')
        avg_speed = lap_match.get('avg_speed')
        avg_hr = lap_match.get('avg_hr')
        
        # Calculate respect score
        target_min = float(target.get('target_min', 0) or 0)
        if signal_col == 'power':
            realized = avg_power or plateau_metrics.get('avg_power', 0)
        else:
            realized = avg_speed or plateau_metrics.get('avg_speed', 0)
        
        respect_score = (realized / target_min * 100) if target_min > 0 else None
        
        return {
            "status": MatchStatus.MATCHED.value,
            "source": MatchSource.LAP.value,
            "confidence": lap_match['confidence'],
            "lap_index": lap_match['lap_index'],
            "target_index": target_idx,
            "start_index": start_idx,
            "end_index": end_idx,
            "duration_sec": end_idx - start_idx,
            "expected_duration": int(target.get('duration', 0)),
            "avg_power": avg_power,
            "avg_speed": avg_speed,
            "avg_hr": avg_hr,
            "plateau_avg_power": plateau_metrics.get('plateau_avg_power'),
            "plateau_avg_speed": plateau_metrics.get('plateau_avg_speed'),
            "respect_score": respect_score,
            "target": target
        }
    
    def _match_by_signal_refined(
        self,
        df: pd.DataFrame,
        signal: np.ndarray,
        signal_col: str,
        segments: List[Dict[str, Any]],
        start_ptr: int,
        target: Dict[str, Any],
        target_min: float,
        duration_s: int,
        sport: str,
        target_idx: int,
        is_resync: bool = False
    ) -> Dict[str, Any]:
        """
        Uses pre-detected signal segments to find the best match for a target.
        """
        cfg = self.config
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
                # We give it a decent score because it likely contains our target
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
            elif intensity_ratio >= 0.70: # Increased hard floor from 0.5 to 0.7
                # Linear penalty between 0.7 and 0.8
                # If ratio is 0.75, score is 0.5
                int_score = 0.5 + 0.5 * ((intensity_ratio - 0.70) / 0.10)
            else:
                int_score = 0
                
            # KILL SWITCH: If intensity score is 0 (i.e. < 70% of target), 
            # the total score is capped at 0.4 to prevent matching purely on duration/proximity.
            if int_score == 0:
                dur_score *= 0.5 # Heavy penalty on duration score too
                
            # 3. Proximity score (prefer segments closer to current pointer)
            # Make it more forgiving for the first target OR if we are resyncing
            prox_limit = 3600 if (target_idx == 0 or is_resync) else 900
            prox_score = 1 - min(1.0, abs(seg['start'] - start_ptr) / prox_limit)
            
            total_score = dur_score * 0.4 + int_score * 0.4 + prox_score * 0.2
            
            if total_score > best_score:
                best_score = total_score
                best_segment = seg

        if best_segment and best_score > 0.5: # Lowered threshold from 0.6
            start_idx = best_segment['start']
            end_idx = best_segment['end']
            
            # 1. Handle too long segments (if grouped by detector)
            if best_segment['duration'] > duration_s * 1.2:
                 # Trim to expected duration centered around max intensity
                 start_idx, end_idx = self._find_best_window(signal, start_idx, end_idx, duration_s)
            
            # 2. Handle too short segments (Target Duration Alignment)
            # If the segment is shorter than target, try to expand it symmetrically
            # to match the planned duration, which is often what manual laps do.
            elif best_segment['duration'] < duration_s:
                diff = duration_s - best_segment['duration']
                # Expand by half the difference on each side
                new_start = max(0, start_idx - diff // 2)
                new_end = min(len(signal), end_idx + (diff - diff // 2))
                
                # Check if expansion is reasonable (not falling into a complete stop)
                # We calculate the mean of the expanded part
                if new_start < start_idx or new_end > end_idx:
                    expanded_mean = np.mean(signal[new_start:new_end])
                    # If expanded mean is still > 85% of original segment mean, we keep it
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
        expected_duration: int
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
                val = interval_df[col].mean()
                metrics[f'avg_{col}'] = float(val) if not pd.isna(val) else None
        
        # Plateau averages (trimmed)
        actual_duration = end_idx - start_idx
        trim_start = min(cfg.plateau_trim_start, actual_duration // 4)
        trim_end = min(cfg.plateau_trim_end, actual_duration // 4)
        
        plateau_start = start_idx + trim_start
        plateau_end = end_idx - trim_end
        
        if plateau_end > plateau_start:
            plateau_df = df.iloc[plateau_start:plateau_end]
            for col in ['power', 'speed']:
                if col in df.columns:
                    val = plateau_df[col].mean()
                    metrics[f'plateau_avg_{col}'] = float(val) if not pd.isna(val) else None
            
            if 'heart_rate' in df.columns:
                val = plateau_df['heart_rate'].mean()
                metrics['avg_hr'] = float(val) if not pd.isna(val) else None
        
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