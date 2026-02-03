"""
Manual Pattern Parser for Interval Descriptions

This module parses human-readable interval descriptions like:
- "10x1Km / r 250m"
- "5*2000m/r500m"
- "10x 3min / r 1min"
- "8*30''/30''"
- "5x1Km / r 1'"

And converts them to a target grid format compatible with IntervalMatcher.

Author: Project K Team
Version: 1.0.0
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class ParsedInterval:
    """A single parsed work or rest interval."""
    type: str  # 'work' or 'rest'
    duration_sec: Optional[int] = None  # Duration in seconds (for time-based)
    distance_m: Optional[float] = None  # Distance in meters (for distance-based)
    is_distance_based: bool = False


@dataclass
class ParsedPattern:
    """Complete parsed interval pattern."""
    repetitions: int
    work: ParsedInterval
    rest: ParsedInterval
    raw_pattern: str = ""
    parse_success: bool = True
    parse_error: Optional[str] = None


class ManualPatternParser:
    """
    Parses manual interval pattern strings into structured data.

    Supported formats:
    - Distance work: "10x1Km", "5*2000m", "3x5000m"
    - Time work: "10x3min", "8x30''", "5x3'"
    - Distance rest: "r 250m", "r500m", "r1km"
    - Time rest: "r 1min", "r1'", "r30''"
    - Combined: "10x1Km / r 250m", "5*2000m/r500m", "10x 3min / r 1min"

    Separators: "/", " / ", ",", " - "
    Multipliers: "x", "*", "×"
    """

    # Regex patterns for parsing
    REPS_PATTERN = r'(\d+)\s*[x×\*]\s*'

    # Distance patterns (km, Km, KM, m, M)
    DISTANCE_PATTERN = r'(\d+(?:[.,]\d+)?)\s*(km|Km|KM|m|M)'

    # Time patterns
    # Formats: 3min, 3', 30'', 3:00, 3m30s, 90s
    TIME_PATTERN = r"(\d+)\s*(?:min(?:utes?)?|'(?!')|m(?!in|M|$))|(\d+)\s*(?:''|sec(?:onds?)?|s)|(\d+):(\d+)"

    # Rest indicator
    REST_INDICATOR = r'[/,\-]\s*(?:r(?:ecup|est|écu)?\s*)?'

    def parse(self, pattern: str) -> ParsedPattern:
        """
        Parse an interval pattern string.

        Args:
            pattern: Human-readable interval description

        Returns:
            ParsedPattern with structured interval data
        """
        if not pattern or not pattern.strip():
            return ParsedPattern(
                repetitions=0,
                work=ParsedInterval(type='work'),
                rest=ParsedInterval(type='rest'),
                raw_pattern=pattern,
                parse_success=False,
                parse_error="Empty pattern"
            )

        pattern = pattern.strip()
        original = pattern

        try:
            # 1. Extract repetitions
            reps, remainder = self._extract_reps(pattern)
            if reps is None:
                return self._parse_error(original, "Could not find repetition count (e.g., 10x)")

            # 2. Split work and rest parts
            work_part, rest_part = self._split_work_rest(remainder)

            # 3. Parse work interval
            work = self._parse_interval(work_part, 'work')
            if work is None:
                return self._parse_error(original, f"Could not parse work interval: {work_part}")

            # 4. Parse rest interval (optional)
            if rest_part:
                rest = self._parse_interval(rest_part, 'rest')
                if rest is None:
                    # Try to parse as just a number (default to distance or time based on work)
                    rest = self._parse_rest_simple(rest_part, work)
            else:
                # No rest specified, create empty rest
                rest = ParsedInterval(type='rest', duration_sec=0)

            return ParsedPattern(
                repetitions=reps,
                work=work,
                rest=rest if rest else ParsedInterval(type='rest', duration_sec=0),
                raw_pattern=original,
                parse_success=True
            )

        except Exception as e:
            return self._parse_error(original, str(e))

    def _parse_error(self, pattern: str, error: str) -> ParsedPattern:
        """Create a failed parse result."""
        return ParsedPattern(
            repetitions=0,
            work=ParsedInterval(type='work'),
            rest=ParsedInterval(type='rest'),
            raw_pattern=pattern,
            parse_success=False,
            parse_error=error
        )

    def _extract_reps(self, pattern: str) -> Tuple[Optional[int], str]:
        """Extract repetition count from pattern."""
        match = re.match(self.REPS_PATTERN, pattern, re.IGNORECASE)
        if match:
            reps = int(match.group(1))
            remainder = pattern[match.end():]
            return reps, remainder
        return None, pattern

    def _split_work_rest(self, pattern: str) -> Tuple[str, Optional[str]]:
        """Split pattern into work and rest parts."""
        # Try various separators
        separators = [
            r'\s*/\s*r(?:ecup|est|écu)?\s*',  # " / r " or "/r"
            r'\s*/\s*',                         # " / "
            r'\s*,\s*r(?:ecup|est|écu)?\s*',   # ", r"
            r'\s*-\s*r(?:ecup|est|écu)?\s*',   # " - r"
            r'\s+r\s+',                         # " r " (space-separated)
        ]

        for sep in separators:
            parts = re.split(sep, pattern, maxsplit=1, flags=re.IGNORECASE)
            if len(parts) == 2:
                return parts[0].strip(), parts[1].strip()

        # No separator found - just work, no rest
        return pattern.strip(), None

    def _parse_interval(self, text: str, interval_type: str) -> Optional[ParsedInterval]:
        """Parse a single interval (work or rest)."""
        if not text:
            return None

        text = text.strip()

        # Try distance first
        distance = self._parse_distance(text)
        if distance is not None:
            return ParsedInterval(
                type=interval_type,
                distance_m=distance,
                is_distance_based=True
            )

        # Try time
        duration = self._parse_time(text)
        if duration is not None:
            return ParsedInterval(
                type=interval_type,
                duration_sec=duration,
                is_distance_based=False
            )

        return None

    def _parse_distance(self, text: str) -> Optional[float]:
        """Parse distance in meters from text."""
        match = re.search(self.DISTANCE_PATTERN, text, re.IGNORECASE)
        if match:
            value = float(match.group(1).replace(',', '.'))
            unit = match.group(2).lower()

            if unit == 'km':
                return value * 1000
            else:  # meters
                return value

        return None

    def _parse_time(self, text: str) -> Optional[int]:
        """Parse time duration in seconds from text."""
        text = text.strip()

        # Pattern: 3min, 3', 3m (minutes)
        min_match = re.search(r"(\d+)\s*(?:min(?:utes?)?|'(?!')|m(?![M]))", text)
        if min_match:
            minutes = int(min_match.group(1))
            # Check for additional seconds
            remaining = text[min_match.end():]
            sec_match = re.search(r"(\d+)\s*(?:''|sec(?:onds?)?|s)", remaining)
            seconds = int(sec_match.group(1)) if sec_match else 0
            return minutes * 60 + seconds

        # Pattern: 30'', 30sec, 30s (seconds only)
        sec_match = re.search(r"(\d+)\s*(?:''|sec(?:onds?)?|s(?:$|\s))", text)
        if sec_match:
            return int(sec_match.group(1))

        # Pattern: 3:00, 1:30 (mm:ss format)
        mmss_match = re.search(r"(\d+):(\d+)", text)
        if mmss_match:
            minutes = int(mmss_match.group(1))
            seconds = int(mmss_match.group(2))
            return minutes * 60 + seconds

        # Just a number - assume minutes if > 10, seconds if <= 10
        num_match = re.match(r"^(\d+)$", text.strip())
        if num_match:
            val = int(num_match.group(1))
            # Heuristic: if small number, likely minutes; if larger, likely seconds
            if val <= 10:
                return val * 60  # Assume minutes
            else:
                return val  # Assume seconds

        return None

    def _parse_rest_simple(
        self,
        text: str,
        work: ParsedInterval
    ) -> Optional[ParsedInterval]:
        """Parse rest when it's just a number, inferring type from work."""
        text = text.strip()

        # If work is distance-based, try to parse rest as distance
        if work.is_distance_based:
            distance = self._parse_distance(text)
            if distance is not None:
                return ParsedInterval(
                    type='rest',
                    distance_m=distance,
                    is_distance_based=True
                )

        # Otherwise try time
        duration = self._parse_time(text)
        if duration is not None:
            return ParsedInterval(
                type='rest',
                duration_sec=duration,
                is_distance_based=False
            )

        # Last resort: try to parse as raw number
        num_match = re.match(r'^(\d+)$', text)
        if num_match:
            val = int(num_match.group(1))
            if work.is_distance_based:
                # Assume meters
                return ParsedInterval(
                    type='rest',
                    distance_m=float(val),
                    is_distance_based=True
                )
            else:
                # Assume seconds
                return ParsedInterval(
                    type='rest',
                    duration_sec=val,
                    is_distance_based=False
                )

        return None

    def generate_target_grid(
        self,
        parsed: ParsedPattern,
        profile: Optional['PhysioProfile'] = None,
        sport: str = 'run'
    ) -> List[Dict[str, Any]]:
        """
        Generate a target grid compatible with IntervalMatcher.

        For distance-based intervals, duration is estimated from profile
        (expected pace) or uses default paces.

        Args:
            parsed: ParsedPattern from parse()
            profile: Optional PhysioProfile for pace estimation
            sport: Sport type for defaults

        Returns:
            List of target interval dicts
        """
        if not parsed.parse_success or parsed.repetitions <= 0:
            return []

        grid = []

        # Estimate work duration if distance-based
        if parsed.work.is_distance_based:
            work_duration = self._estimate_duration_from_distance(
                parsed.work.distance_m,
                profile,
                sport,
                is_work=True
            )
        else:
            work_duration = parsed.work.duration_sec or 60

        # Estimate rest duration if distance-based
        if parsed.rest.is_distance_based:
            rest_duration = self._estimate_duration_from_distance(
                parsed.rest.distance_m,
                profile,
                sport,
                is_work=False
            )
        else:
            rest_duration = parsed.rest.duration_sec or 0

        # Get target intensity from profile
        target_min = self._get_target_intensity(profile, sport)

        for i in range(parsed.repetitions):
            # Work interval
            work_target = {
                'type': 'active',
                'duration': work_duration,
                'distance_m': parsed.work.distance_m,
                'target_min': target_min,
                'target_type': 'pace' if sport == 'run' else 'power',
                'planned_rest': rest_duration,
                'rep_index': i + 1,
                'total_reps': parsed.repetitions
            }
            grid.append(work_target)

        return grid

    def _estimate_duration_from_distance(
        self,
        distance_m: Optional[float],
        profile: Optional['PhysioProfile'],
        sport: str,
        is_work: bool
    ) -> int:
        """Estimate duration in seconds from distance."""
        if distance_m is None or distance_m <= 0:
            return 60  # Default 1 minute

        # Default paces (m/s)
        if sport == 'run':
            if is_work:
                # Work pace: ~4:00/km = 4.17 m/s
                default_pace = 4.0
            else:
                # Recovery pace: ~6:00/km = 2.78 m/s
                default_pace = 2.5
        elif sport == 'bike':
            if is_work:
                default_pace = 10.0  # ~36 km/h
            else:
                default_pace = 6.0   # ~22 km/h
        else:
            default_pace = 3.0

        # Use profile CS if available
        if profile and profile.cp and profile.cp > 0 and profile.cp < 20:
            # CP is in m/s for run
            if is_work:
                pace = profile.cp * 0.95  # Slightly above threshold
            else:
                pace = profile.cp * 0.70  # Recovery
        else:
            pace = default_pace

        duration = distance_m / pace
        return int(round(duration))

    def _get_target_intensity(
        self,
        profile: Optional['PhysioProfile'],
        sport: str
    ) -> float:
        """Get target minimum intensity from profile or defaults."""
        if profile and profile.cp and profile.cp > 0:
            # Target ~95% of CP for intervals
            return profile.cp * 0.95

        # Defaults
        if sport == 'run':
            return 4.0  # m/s (~4:10/km)
        elif sport == 'bike':
            return 250  # Watts
        else:
            return 3.0


def parse_pattern(pattern: str) -> ParsedPattern:
    """Convenience function to parse a pattern string."""
    parser = ManualPatternParser()
    return parser.parse(pattern)


def pattern_to_grid(
    pattern: str,
    profile: Optional['PhysioProfile'] = None,
    sport: str = 'run'
) -> List[Dict[str, Any]]:
    """Convenience function to parse pattern and generate grid."""
    parser = ManualPatternParser()
    parsed = parser.parse(pattern)
    return parser.generate_target_grid(parsed, profile, sport)
