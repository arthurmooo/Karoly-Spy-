"""
Confidence-Based Validation for Interval Detection

This module implements a multi-factor confidence scoring system for
validating detected intervals. Instead of strict LAP-only rules,
high-confidence signal detections can be accepted.

Key Features:
- Composite confidence score from 5 factors
- VALIDATION_THRESHOLD = 0.85 for signal acceptance
- Detailed metrics breakdown for debugging

Author: Project K Team
Version: 1.0.0
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, List
import numpy as np


# Global threshold for accepting signal-based detections
VALIDATION_THRESHOLD = 0.85


@dataclass
class ConfidenceMetrics:
    """
    Multi-factor confidence assessment for a detected interval.

    Each component is scored 0-1:
    - plateau_stability: Based on CV (coefficient of variation) during plateau
    - duration_match: How close detected duration is to expected
    - intensity_match: How close detected intensity is to target
    - recovery_coherence: Whether preceding recovery matches plan
    - edge_quality: Quality of detected start/end boundaries

    The composite_score is a weighted average used for validation.
    """
    plateau_stability: float = 0.0
    duration_match: float = 0.0
    intensity_match: float = 0.0
    recovery_coherence: float = 0.0
    edge_quality: float = 0.0

    @property
    def composite_score(self) -> float:
        """
        Calculate weighted composite confidence score.

        Weights reflect importance for Karoly's use case:
        - Intensity (25%): Must hit target power/speed
        - Plateau (25%): Stable effort, not choppy
        - Duration (20%): Correct interval length
        - Recovery (15%): Rest periods match plan
        - Edge (15%): Clean boundaries for metrics accuracy
        """
        return (
            0.25 * self.plateau_stability +
            0.20 * self.duration_match +
            0.25 * self.intensity_match +
            0.15 * self.recovery_coherence +
            0.15 * self.edge_quality
        )

    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary for serialization."""
        return {
            'plateau_stability': round(self.plateau_stability, 3),
            'duration_match': round(self.duration_match, 3),
            'intensity_match': round(self.intensity_match, 3),
            'recovery_coherence': round(self.recovery_coherence, 3),
            'edge_quality': round(self.edge_quality, 3),
            'composite_score': round(self.composite_score, 3)
        }

    def is_valid(self, threshold: float = VALIDATION_THRESHOLD) -> bool:
        """Check if this detection passes the validation threshold."""
        return self.composite_score >= threshold


class ConfidenceCalculator:
    """
    Calculates confidence metrics for detected intervals.

    This class analyzes a detected interval against its target
    to produce a ConfidenceMetrics object that can be used for
    validation decisions.
    """

    def __init__(self, sport: str = 'bike'):
        """
        Initialize confidence calculator.

        Args:
            sport: Sport type for sport-specific adjustments
        """
        self.sport = sport

    def calculate(
        self,
        detection: Dict[str, Any],
        target: Dict[str, Any],
        signal_segment: np.ndarray,
        previous_detection: Optional[Dict[str, Any]] = None,
        edge_quality: float = 0.5
    ) -> ConfidenceMetrics:
        """
        Calculate confidence metrics for a detection.

        Args:
            detection: Detection result dict with start_index, end_index, etc.
            target: Target dict with duration, target_min, planned_rest, etc.
            signal_segment: Raw signal values for the detected interval
            previous_detection: Previous detection for recovery coherence
            edge_quality: Pre-calculated edge quality score (0-1)

        Returns:
            ConfidenceMetrics object with all component scores
        """
        # 1. Plateau Stability (based on CV)
        plateau_stability = self._calculate_plateau_stability(signal_segment)

        # 2. Duration Match
        duration_match = self._calculate_duration_match(
            detection.get('duration_sec', 0),
            int(target.get('duration', 0))
        )

        # 3. Intensity Match
        intensity_match = self._calculate_intensity_match(
            detection,
            target,
            signal_segment
        )

        # 4. Recovery Coherence
        recovery_coherence = self._calculate_recovery_coherence(
            detection,
            previous_detection,
            target.get('planned_rest')
        )

        return ConfidenceMetrics(
            plateau_stability=plateau_stability,
            duration_match=duration_match,
            intensity_match=intensity_match,
            recovery_coherence=recovery_coherence,
            edge_quality=edge_quality
        )

    def _calculate_plateau_stability(self, signal: np.ndarray) -> float:
        """
        Calculate stability score based on coefficient of variation.

        Lower CV = more stable plateau = higher score.
        CV < 5% -> 1.0 (excellent)
        CV > 25% -> 0.0 (very unstable)
        """
        if signal is None or len(signal) < 10:
            return 0.5  # Neutral score for insufficient data

        # Trim first and last 10% to focus on plateau
        trim = max(1, len(signal) // 10)
        plateau = signal[trim:-trim] if len(signal) > 20 else signal

        mean_val = np.mean(plateau)
        if mean_val <= 0:
            return 0.0

        cv = np.std(plateau) / mean_val

        # Map CV to score (linear interpolation)
        # CV <= 0.05 -> 1.0
        # CV >= 0.25 -> 0.0
        if cv <= 0.05:
            return 1.0
        elif cv >= 0.25:
            return 0.0
        else:
            return 1.0 - (cv - 0.05) / 0.20

    def _calculate_duration_match(
        self,
        actual_duration: int,
        expected_duration: int
    ) -> float:
        """
        Calculate duration match score.

        ±10% -> 1.0
        ±30% -> 0.5
        >50% off -> 0.0
        """
        if expected_duration <= 0:
            return 0.5  # Neutral for missing target

        ratio = actual_duration / expected_duration
        error = abs(1.0 - ratio)

        if error <= 0.10:
            return 1.0
        elif error <= 0.30:
            # Linear interpolation between 0.10 and 0.30
            return 1.0 - (error - 0.10) / 0.20 * 0.5
        elif error <= 0.50:
            # Linear interpolation between 0.30 and 0.50
            return 0.5 - (error - 0.30) / 0.20 * 0.5
        else:
            return 0.0

    def _calculate_intensity_match(
        self,
        detection: Dict[str, Any],
        target: Dict[str, Any],
        signal: np.ndarray
    ) -> float:
        """
        Calculate intensity match score.

        Compares detected avg to target_min.
        90-110% of target -> 1.0
        70-90% or 110-130% -> 0.5-1.0 (scaled)
        <70% or >130% -> 0.0-0.5 (scaled)
        """
        target_min = float(target.get('target_min', 0) or 0)

        if target_min <= 0:
            # No target intensity specified
            return 0.7  # Slight positive bias (we found something)

        # Get detected intensity
        detected_avg = None
        if self.sport == 'bike':
            detected_avg = detection.get('avg_power') or detection.get('plateau_avg_power')
        else:
            detected_avg = detection.get('avg_speed') or detection.get('plateau_avg_speed')

        if detected_avg is None and len(signal) > 0:
            detected_avg = np.mean(signal)

        if detected_avg is None or detected_avg <= 0:
            return 0.3  # Low confidence for missing intensity

        ratio = detected_avg / target_min

        # Score based on how close to target
        if 0.90 <= ratio <= 1.10:
            return 1.0
        elif 0.80 <= ratio < 0.90:
            return 0.5 + (ratio - 0.80) / 0.10 * 0.5
        elif 1.10 < ratio <= 1.20:
            return 1.0 - (ratio - 1.10) / 0.10 * 0.2
        elif 0.70 <= ratio < 0.80:
            return 0.2 + (ratio - 0.70) / 0.10 * 0.3
        elif ratio > 1.20 and ratio <= 1.50:
            return 0.6  # Over-performed, still valid
        else:
            return max(0.0, 0.2 - abs(1.0 - ratio) / 2.0)

    def _calculate_recovery_coherence(
        self,
        detection: Dict[str, Any],
        previous_detection: Optional[Dict[str, Any]],
        planned_rest: Optional[int]
    ) -> float:
        """
        Calculate recovery coherence score.

        Checks if the gap between this and previous interval
        matches the planned rest duration.
        """
        if previous_detection is None:
            return 0.8  # First interval, assume coherent

        if planned_rest is None or planned_rest <= 0:
            return 0.7  # No rest specified, slight positive bias

        prev_end = previous_detection.get('end_index', 0)
        curr_start = detection.get('start_index', 0)

        actual_gap = curr_start - prev_end

        if actual_gap <= 0:
            return 0.0  # Overlapping intervals

        ratio = actual_gap / planned_rest

        # Score based on gap match
        if 0.75 <= ratio <= 1.25:
            # Within ±25% of planned rest
            return 1.0 - abs(1.0 - ratio) / 0.25 * 0.2
        elif 0.50 <= ratio <= 1.50:
            # Within ±50%
            return 0.5
        else:
            return 0.2


def validate_detection_set(
    detections: List[Dict[str, Any]],
    threshold: float = VALIDATION_THRESHOLD
) -> bool:
    """
    Validate a set of signal-based detections.

    All detections must have confidence >= threshold for the set to be valid.

    Args:
        detections: List of detection dicts with 'confidence' key
        threshold: Minimum confidence required

    Returns:
        True if all signal detections meet threshold
    """
    signal_detections = [
        d for d in detections
        if d.get('source') == 'signal'
    ]

    if not signal_detections:
        return True  # No signal detections to validate

    return all(
        d.get('confidence', 0) >= threshold
        for d in signal_detections
    )


def is_high_confidence_match(
    detections: List[Dict[str, Any]],
    num_planned: int,
    threshold: float = VALIDATION_THRESHOLD
) -> bool:
    """
    Check if detections represent a high-confidence signal match.

    This is used as an alternative to the strict LAP-only rule.
    Conditions:
    1. At least 95% of planned intervals detected
    2. All signal-based detections have confidence >= threshold

    Args:
        detections: List of detection dicts
        num_planned: Number of planned intervals in target grid
        threshold: Confidence threshold for signal detections

    Returns:
        True if this is a valid high-confidence signal match
    """
    if num_planned <= 0:
        return False

    # Check coverage
    num_matched = len(detections)
    coverage = num_matched / num_planned

    if coverage < 0.95:
        return False

    # Check signal detection confidence
    signal_detections = [
        d for d in detections
        if d.get('source') == 'signal'
    ]

    if not signal_detections:
        # All LAP-based, defer to LAP logic
        return False

    # All signal detections must meet threshold
    return all(
        d.get('confidence', 0) >= threshold
        for d in signal_detections
    )
