"""
Multi-Signal Edge Detector V1 - Surgical Precision for Interval Boundaries

This module implements advanced edge detection for interval start/end boundaries
using multiple physiological signals cross-validated for +/-2s precision.

Key Features:
- Cadence gradient as leading indicator (1-3s before power/speed change)
- Cross-validation between cadence and power/speed gradients
- Expanded search window (+/-8s) for better boundary capture
- Adaptive hysteresis based on target zone and athlete CP

Author: Project K Team
Version: 1.0.0
"""

import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from scipy.signal import savgol_filter


@dataclass
class EdgeResult:
    """Result of an edge detection attempt."""
    index: int
    confidence: float
    source: str  # 'cadence', 'power', 'speed', 'cross_validated'
    gradient_strength: float


class MultiSignalEdgeDetector:
    """
    Detects interval boundaries using multi-signal cross-validation.

    The cadence signal typically leads power/speed by 1-3 seconds during
    transitions (athlete starts pedaling/running faster before the mechanical
    output increases). This class exploits this physiological lag for
    surgical precision on boundaries.
    """

    # Configuration
    SEARCH_WINDOW_SEC = 8        # ±8s search window (was 3s)
    MIN_CADENCE_GRADIENT = 3    # RPM/s minimum to detect transition (was 5)
    MIN_POWER_GRADIENT = 15     # W/s for bike
    MIN_SPEED_GRADIENT = 0.3    # m/s/s for run
    GRADIENT_WINDOW = 2         # Seconds for gradient calculation
    CROSS_VALIDATION_TOLERANCE = 3  # Max seconds between cadence and power edges

    def __init__(
        self,
        df: pd.DataFrame,
        sport: str = 'bike',
        profile: Optional['PhysioProfile'] = None
    ):
        """
        Initialize the edge detector.

        Args:
            df: DataFrame with 1Hz data (power, speed, cadence, heart_rate)
            sport: Sport type ('bike', 'run', 'swim')
            profile: Optional PhysioProfile for adaptive thresholds
        """
        self.df = df
        self.sport = sport
        self.profile = profile
        self.sample_rate = 1  # Assuming 1Hz

        # Extract signals
        self.power = df['power'].fillna(0).values if 'power' in df.columns else None
        self.speed = df['speed'].fillna(0).values if 'speed' in df.columns else None
        self.cadence = df['cadence'].fillna(0).values if 'cadence' in df.columns else None
        self.heart_rate = df['heart_rate'].fillna(0).values if 'heart_rate' in df.columns else None

        # Select primary mechanical signal
        if sport == 'bike' and self.power is not None and np.mean(self.power) > 10:
            self.primary_signal = self.power
            self.signal_type = 'power'
            self.min_gradient = self.MIN_POWER_GRADIENT
        else:
            self.primary_signal = self.speed if self.speed is not None else self.power
            self.signal_type = 'speed' if self.speed is not None else 'power'
            self.min_gradient = self.MIN_SPEED_GRADIENT

        # Precompute gradients
        self._precompute_gradients()

    def _precompute_gradients(self):
        """Precompute smoothed gradients for all signals."""
        window = self.GRADIENT_WINDOW * self.sample_rate

        # Cadence gradient
        if self.cadence is not None and len(self.cadence) > window:
            # Smooth first to reduce noise
            cadence_smooth = pd.Series(self.cadence).rolling(
                window=3, center=True, min_periods=1
            ).mean().values
            self.cadence_grad = np.gradient(cadence_smooth)
        else:
            self.cadence_grad = None

        # Primary signal gradient (power or speed)
        if self.primary_signal is not None and len(self.primary_signal) > window:
            signal_smooth = pd.Series(self.primary_signal).rolling(
                window=3, center=True, min_periods=1
            ).mean().values
            self.primary_grad = np.gradient(signal_smooth)
        else:
            self.primary_grad = None

    def find_edge(
        self,
        tentative_idx: int,
        edge_type: str = 'start',
        target_intensity: Optional[float] = None
    ) -> EdgeResult:
        """
        Find the precise edge (start or end) near a tentative index.

        Uses multi-signal cross-validation:
        1. For 'start': Look for cadence rise BEFORE power/speed rise
        2. For 'end': Look for cadence drop BEFORE power/speed drop
        3. Cross-validate: Both signals must agree within 3s

        Args:
            tentative_idx: Initial estimate of edge position
            edge_type: 'start' for interval beginning, 'end' for interval end
            target_intensity: Optional target intensity for adaptive thresholds

        Returns:
            EdgeResult with refined index, confidence, source, and gradient strength
        """
        if len(self.df) == 0:
            return EdgeResult(
                index=tentative_idx,
                confidence=0.0,
                source='fallback',
                gradient_strength=0.0
            )

        # Define search window
        search_start = max(0, tentative_idx - self.SEARCH_WINDOW_SEC)
        search_end = min(len(self.df), tentative_idx + self.SEARCH_WINDOW_SEC)

        if search_end <= search_start:
            return EdgeResult(
                index=tentative_idx,
                confidence=0.0,
                source='fallback',
                gradient_strength=0.0
            )

        # Strategy 1: Find cadence edge (leading indicator)
        cadence_edge = self._find_cadence_edge(search_start, search_end, edge_type)

        # Strategy 2: Find primary signal edge (power/speed)
        primary_edge = self._find_primary_edge(search_start, search_end, edge_type)

        # Cross-validation
        if cadence_edge is not None and primary_edge is not None:
            # Check if edges agree within tolerance
            edge_diff = abs(cadence_edge['index'] - primary_edge['index'])

            if edge_diff <= self.CROSS_VALIDATION_TOLERANCE:
                # Cross-validated: Use cadence edge (leading) for start,
                # primary edge for end (more reliable for drop detection)
                if edge_type == 'start':
                    best_idx = cadence_edge['index']
                    confidence = 0.95  # High confidence for cross-validated
                else:
                    best_idx = primary_edge['index']
                    confidence = 0.90

                return EdgeResult(
                    index=best_idx,
                    confidence=confidence,
                    source='cross_validated',
                    gradient_strength=max(
                        cadence_edge['strength'],
                        primary_edge['strength']
                    )
                )

        # Fallback: Use whichever edge we found
        if cadence_edge is not None:
            return EdgeResult(
                index=cadence_edge['index'],
                confidence=0.75,
                source='cadence',
                gradient_strength=cadence_edge['strength']
            )

        if primary_edge is not None:
            return EdgeResult(
                index=primary_edge['index'],
                confidence=0.70,
                source=self.signal_type,
                gradient_strength=primary_edge['strength']
            )

        # No edge found: return tentative with low confidence
        return EdgeResult(
            index=tentative_idx,
            confidence=0.50,
            source='fallback',
            gradient_strength=0.0
        )

    def _find_cadence_edge(
        self,
        search_start: int,
        search_end: int,
        edge_type: str
    ) -> Optional[Dict]:
        """Find edge in cadence signal."""
        if self.cadence_grad is None:
            return None

        segment = self.cadence_grad[search_start:search_end]
        if len(segment) == 0:
            return None

        if edge_type == 'start':
            # Look for positive gradient (cadence rising)
            peaks = np.where(segment > self.MIN_CADENCE_GRADIENT)[0]
            if len(peaks) == 0:
                return None
            # Take first significant rise
            best_offset = peaks[0]
            strength = float(segment[best_offset])
        else:
            # Look for negative gradient (cadence dropping)
            peaks = np.where(segment < -self.MIN_CADENCE_GRADIENT)[0]
            if len(peaks) == 0:
                return None
            # Take last significant drop
            best_offset = peaks[-1]
            strength = float(abs(segment[best_offset]))

        return {
            'index': search_start + best_offset,
            'strength': strength
        }

    def _find_primary_edge(
        self,
        search_start: int,
        search_end: int,
        edge_type: str
    ) -> Optional[Dict]:
        """Find edge in primary signal (power/speed)."""
        if self.primary_grad is None:
            return None

        segment = self.primary_grad[search_start:search_end]
        if len(segment) == 0:
            return None

        threshold = self.min_gradient

        if edge_type == 'start':
            # Look for positive gradient
            peaks = np.where(segment > threshold)[0]
            if len(peaks) == 0:
                return None
            best_offset = peaks[0]
            strength = float(segment[best_offset])
        else:
            # Look for negative gradient
            peaks = np.where(segment < -threshold)[0]
            if len(peaks) == 0:
                return None
            best_offset = peaks[-1]
            strength = float(abs(segment[best_offset]))

        return {
            'index': search_start + best_offset,
            'strength': strength
        }

    def refine_boundaries(
        self,
        start_idx: int,
        end_idx: int,
        target_duration: int
    ) -> Tuple[int, int]:
        """
        Refine both start and end boundaries for an interval.

        Args:
            start_idx: Tentative start index
            end_idx: Tentative end index
            target_duration: Expected duration in seconds

        Returns:
            Tuple of (refined_start, refined_end)
        """
        # Refine start
        start_result = self.find_edge(start_idx, edge_type='start')
        refined_start = start_result.index

        # Refine end
        end_result = self.find_edge(end_idx, edge_type='end')
        refined_end = end_result.index

        # Sanity checks
        if refined_end <= refined_start:
            # Invalid refinement, use originals
            refined_start = start_idx
            refined_end = end_idx

        # Duration check: don't accept wildly different duration
        actual_duration = refined_end - refined_start
        if actual_duration < target_duration * 0.5 or actual_duration > target_duration * 2.0:
            # Refinement went wrong, fall back
            refined_start = start_idx
            refined_end = max(start_idx + target_duration, end_idx)

        # Clamp to valid range
        refined_start = max(0, refined_start)
        refined_end = min(len(self.df), refined_end)

        return refined_start, refined_end


class AdaptiveHysteresis:
    """
    Calculates zone-based entry/exit thresholds for interval detection.

    Instead of fixed 80%/65% thresholds, this class determines thresholds
    based on the target zone (Z1-Z5) relative to the athlete's CP.

    Zero Data Noire Rule: If CP is missing, uses conservative fixed thresholds.
    """

    # Zone thresholds as (entry_ratio, exit_ratio) relative to target
    # Higher zones need tighter tracking (closer to target)
    ZONE_THRESHOLDS = {
        'Z5': (0.95, 0.85),  # Very tight - must hit target
        'Z4': (0.90, 0.80),  # Tight
        'Z3': (0.85, 0.75),  # Moderate
        'Z2': (0.80, 0.70),  # Relaxed (endurance)
        'Z1': (0.75, 0.60),  # Very relaxed (recovery)
    }

    # Fallback thresholds when CP is unknown
    FALLBACK_ENTRY = 0.80
    FALLBACK_EXIT = 0.65

    def __init__(self, sport: str = 'bike'):
        """
        Initialize adaptive hysteresis calculator.

        Args:
            sport: Sport type for sport-specific adjustments
        """
        self.sport = sport

    def calculate_thresholds(
        self,
        target_min: float,
        cp: Optional[float] = None
    ) -> Tuple[float, float]:
        """
        Calculate entry and exit thresholds for a target intensity.

        Args:
            target_min: Target minimum intensity (power/speed)
            cp: Optional Critical Power/Speed for zone determination

        Returns:
            Tuple of (entry_threshold, exit_threshold) as absolute values
        """
        if cp is None or cp <= 0 or target_min <= 0:
            # Zero Data Noire: Use fixed fallback
            entry = target_min * self.FALLBACK_ENTRY
            exit_val = target_min * self.FALLBACK_EXIT
            return entry, exit_val

        # Determine zone based on target/CP ratio
        zone = self._determine_zone(target_min, cp)

        # Get thresholds for this zone
        entry_ratio, exit_ratio = self.ZONE_THRESHOLDS.get(zone, (0.80, 0.65))

        # Calculate absolute thresholds
        entry = target_min * entry_ratio
        exit_val = target_min * exit_ratio

        return entry, exit_val

    def _determine_zone(self, target: float, cp: float) -> str:
        """
        Determine training zone based on target/CP ratio.

        Zone boundaries (approximate):
        - Z5: >= 105% CP (VO2max/Anaerobic)
        - Z4: 95-105% CP (Threshold)
        - Z3: 85-95% CP (Tempo)
        - Z2: 75-85% CP (Endurance)
        - Z1: < 75% CP (Recovery)
        """
        ratio = target / cp

        if ratio >= 1.05:
            return 'Z5'
        elif ratio >= 0.95:
            return 'Z4'
        elif ratio >= 0.85:
            return 'Z3'
        elif ratio >= 0.75:
            return 'Z2'
        else:
            return 'Z1'

    def get_zone_for_target(
        self,
        target_min: float,
        cp: Optional[float]
    ) -> str:
        """
        Get the training zone string for a target intensity.

        Useful for logging and debugging.
        """
        if cp is None or cp <= 0:
            return 'UNKNOWN'
        return self._determine_zone(target_min, cp)
