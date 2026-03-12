from typing import List, Dict, Any, Union
import re

class NolioPlanParser:
    """
    Parses Nolio structured workout JSON to extract a linear 'Target Grid' of intervals.
    Handles nested repetitions and complex wave structures.
    """

    def parse(
        self,
        structure: Union[Dict[str, Any], List[Any]],
        sport_type: str = "run",
        merge_adjacent_work: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Main entry point. Flattens the structure into a list of active intervals.

        Args:
            structure: Nolio workout JSON structure
            sport_type: Type of sport ('run', 'bike', 'swim')
            merge_adjacent_work: If True, fuse consecutive work blocks (Z3+Z2)
                                without rest between them into single intervals.
                                This is for the Karoly system where Z2 (70-80%)
                                is considered intense work.
        """
        self.sport_type = sport_type.lower()
        steps = []

        # Normalize input to a list of steps/blocks
        if isinstance(structure, dict):
            # If the dict IS a block (has 'type'), treat it as an item.
            items = [structure]
        elif isinstance(structure, list):
            items = structure
        else:
            return []

        # Recursively flatten
        self._flatten(items, steps)

        # Filter for work intervals
        target_grid = []
        for step in steps:
            if self._is_work_step(step):
                interval = self._extract_interval_data(step)
                if interval:
                    target_grid.append(interval)

        # Optionally merge adjacent work blocks
        if merge_adjacent_work and len(target_grid) > 1:
            target_grid = self._merge_adjacent_work_blocks(target_grid)

        return target_grid

    def _merge_adjacent_work_blocks(self, intervals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merge consecutive work intervals that are adjacent (no rest between them).

        This handles cases like 5×(1'30" Z3 + 3'30" Z2) where Z3 and Z2 are both
        considered "work" in the Karoly system. The result is 5 blocks of 5 minutes.

        Logic:
        - Intervals are considered adjacent if they appear back-to-back in the plan
        - We detect adjacency by looking at repeating patterns (e.g., 90s + 210s)
        - If we see alternating durations that sum to a consistent total, merge them
        """
        if len(intervals) < 2:
            return intervals

        merged = []
        i = 0

        while i < len(intervals):
            current = intervals[i]

            # Look ahead to see if next interval should be merged
            if i + 1 < len(intervals):
                next_interval = intervals[i + 1]

                # Check if these two intervals form a mergeable pair
                # Heuristic: If they have different durations and both are "active" type,
                # they likely represent Z3+Z2 within a single repetition block
                current_dur = current.get('duration', 0)
                next_dur = next_interval.get('duration', 0)

                # Detect pattern: should we merge?
                # We merge if:
                # 1. Both are "active" type (work intervals)
                # 2. They have different durations (suggesting Z3 vs Z2)
                # 3. The pattern repeats (i.e., same durations appear later)
                should_merge = self._should_merge_pair(intervals, i)

                if should_merge:
                    # Merge current and next into one interval
                    merged_interval = self._create_merged_interval(current, next_interval)
                    merged.append(merged_interval)
                    i += 2  # Skip both intervals
                    continue

            # No merge - keep as is
            merged.append(current)
            i += 1

        return merged

    def _should_merge_pair(self, intervals: List[Dict[str, Any]], idx: int) -> bool:
        """
        Determine if interval at idx should be merged with interval at idx+1.

        We look for repeating patterns that suggest Z3+Z2 combinations:
        - Pattern like [90, 210, 90, 210, 90, 210, ...] should merge pairs
        - Pattern like [120, 120, 120, ...] should NOT merge (same duration = separate work blocks)
        """
        if idx + 1 >= len(intervals):
            return False

        current = intervals[idx]
        next_int = intervals[idx + 1]

        current_dur = current.get('duration', 0)
        next_dur = next_int.get('duration', 0)

        # Don't merge if durations are very similar (same type of work)
        if current_dur > 0 and abs(current_dur - next_dur) / current_dur < 0.2:
            return False

        # Check if this pattern repeats
        # Look for the same (current_dur, next_dur) pattern appearing later
        pattern_count = 0
        for j in range(0, len(intervals) - 1, 2):
            if j == idx:
                continue
            other_cur = intervals[j].get('duration', 0)
            other_next = intervals[j + 1].get('duration', 0) if j + 1 < len(intervals) else 0

            # Same pattern with 10% tolerance
            if (abs(other_cur - current_dur) / max(current_dur, 1) < 0.1 and
                abs(other_next - next_dur) / max(next_dur, 1) < 0.1):
                pattern_count += 1

        # If pattern repeats at least once (plus the current), it's a merge pattern
        # Total occurrences should be >= 2 (including current)
        # For 5×(Z3+Z2), we'd have 5 pairs, so pattern_count would be 4 (excluding current)
        return pattern_count >= 1

    def _create_merged_interval(self, first: Dict[str, Any], second: Dict[str, Any]) -> Dict[str, Any]:
        """Create a single merged interval from two adjacent intervals."""
        dur1 = first.get('duration', 0)
        dur2 = second.get('duration', 0)
        total_duration = dur1 + dur2

        dist1 = first.get('distance_m', 0)
        dist2 = second.get('distance_m', 0)
        total_distance = dist1 + dist2

        # Weighted average of targets (if both have targets)
        target_min_1 = first.get('target_min') or 0
        target_min_2 = second.get('target_min') or 0

        if dur1 + dur2 > 0 and (target_min_1 or target_min_2):
            weighted_target = (target_min_1 * dur1 + target_min_2 * dur2) / total_duration
        else:
            weighted_target = target_min_1 or target_min_2

        return {
            "type": first.get('type', 'active'),
            "name": f"{first.get('name', '')} + {second.get('name', '')}".strip(' +'),
            "duration": total_duration,
            "distance_m": total_distance,
            "target_min": weighted_target if weighted_target else None,
            "target_max": None,  # Hard to combine
            "target_type": first.get('target_type') or second.get('target_type'),
            "merged_from": [first, second]  # Keep reference for debugging
        }

    def _flatten(self, items: List[Any], result: List[Any]):
        """Recursively walks the structure to produce a linear list of steps."""
        for item in items:
            type_ = item.get("type", "")
            
            if type_ == "repetition":
                count = int(item.get("value", 1))
                sub_steps = item.get("steps", [])
                # Repeat the sub-steps N times
                for _ in range(count):
                    self._flatten(sub_steps, result)
            else:
                # It's a leaf step (or unknown block we treat as step)
                result.append(item)

    def _is_work_step(self, step: Dict[str, Any]) -> bool:
        """Determines if a step is a 'Work' interval."""
        intensity = step.get("intensity_type", "").lower()
        name = step.get("name", "").lower()
        pct_low = step.get("step_percent_low", 0)
        target_type = step.get("target_type", "").lower()
        duration = step.get("step_duration_value", 0)

        # 0. Filter out RPE-only entries (no actual workout step)
        if target_type == "rpe":
            return False

        # 0b. Filter out zero-duration steps (metadata, not actual intervals)
        if duration == 0:
            return False

        # 0c. PRIORITY RULE (2026-02-11):
        # Nolio sometimes labels high-intensity tempo blocks as "cooldown".
        # If intensity percentage is high enough, treat as work regardless of label.
        if pct_low:
            try:
                if int(pct_low) >= 90:
                    return True
            except (TypeError, ValueError):
                pass

        # 1. Explicit recovery types
        if intensity in ["recovery", "cooldown", "warmup"]:
            return False

        # 2. Explicit work types
        if intensity in ["active", "ramp_up"]:
            return True
            
        # 3. Heuristic based on Intensity Percentage (Primary fallback)
        if pct_low:
            # If percentage is low (< 80%), it's definitely recovery/transition
            if int(pct_low) < 80:
                return False
            # High intensity percentage -> Work
            if int(pct_low) >= 80:
                return True
            
        # 4. Heuristic based on Name (Secondary fallback)
        if any(kw in name for kw in ["échauffement", "récup", "repos", "calme", "wu", "cd", "cooldown"]):
            return False
            
        # Default: if no info, treat as work ONLY if it's not explicitly labeled as rest
        return intensity == ""

    def _extract_interval_data(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts standardized data from a step."""
        
        # 1. Extract Target First (needed for Duration estimation)
        target_min = step.get("target_value_min")
        target_max = step.get("target_value_max")
        target_type = step.get("target_type") 
        
        # Convert Target values to Speed (m/s) if they look like Pace
        if target_type == "pace":
            t_min_val = float(target_min or 0)
            t_max_val = float(target_max or 0)
            
            def is_realistic_speed(val):
                return 1.5 <= val <= 6.5
            
            def convert_pace_to_speed(val):
                if val <= 0: return 0
                return 1000.0 / (val * 60.0)
            
            def convert_kmh_to_speed(val):
                return val / 3.6
            
            # Logic to disambiguate Pace (min/km) vs Speed (km/h)
            # 1. Check magnitudes
            if t_min_val > 10.0:
                # Likely km/h (e.g. 12 km/h)
                target_min = convert_kmh_to_speed(t_min_val)
                target_max = convert_kmh_to_speed(t_max_val) if t_max_val else None
            elif t_min_val < 2.0:
                # Likely m/s (rare in UI but possible in backend) or weird pace
                target_min = convert_pace_to_speed(t_min_val) # Treat as pace 1.5? Unlikely.
                # Actually if < 2.0 it's likely already m/s if type was speed, but here type is pace.
                # Nolio usually sends pace in float minutes (4.5 = 4:30).
                # 4:30/km = 4.5.
                # 0.5 min/km? Impossible.
                # Let's assume standard Nolio Pace float (minutes).
                target_min = convert_pace_to_speed(t_min_val)
                target_max = convert_pace_to_speed(t_max_val) if t_max_val else None
            if t_min_val > 10.0:
                # Likely km/h (e.g. 12 km/h)
                target_min = convert_kmh_to_speed(t_min_val)
                target_max = convert_kmh_to_speed(t_max_val) if t_max_val else None
            elif t_min_val < 2.0:
                # Likely m/s (rare in UI but possible in backend) or weird pace
                target_min = convert_pace_to_speed(t_min_val)
                target_max = convert_pace_to_speed(t_max_val) if t_max_val else None
            else:
                # Ambiguous Range (2.0 - 10.0)
                # Could be Pace (min/km) or Speed (m/s).
                # Heuristic: Speed increases (Min < Max), Pace decreases (Min > Max in intensity, but Nolio sends numeric Min/Max)
                # Actually Nolio sends numeric Min and Max.
                # If Speed: [15 km/h, 20 km/h] -> [4.16 m/s, 5.55 m/s]. Min=4.16, Max=5.55.
                # If Pace: [4:00/km, 3:00/km] -> [4.0 min, 3.0 min].
                # Does Nolio send Min=3.0, Max=4.0? Or Min=4.0, Max=3.0?
                # Usually APIs send Min numeric value as Min.
                
                # Let's verify with the specific case:
                # JSON: min=4.84, max=5.58.
                # User says: 17.39 km/h (4.83 m/s) - 20.11 km/h (5.58 m/s).
                # So Min=4.84 is the Low Intensity (17kmh). Max=5.58 is High Intensity (20kmh).
                # So Speed follows Min < Max.
                
                # If it were Pace: 4.84 min/km (12.4 km/h) to 5.58 min/km (10.7 km/h).
                # So Min would be Higher Intensity? No, Min numeric (4.84) is Faster (Higher Intensity).
                # Max numeric (5.58) is Slower (Lower Intensity).
                # So for Pace, the "High Intensity Bound" is the LOWER numeric value.
                
                # BUT, usually Nolio steps have `step_percent_low` and `high`.
                # If `target_value_min` corresponds to `percent_low` (91%), and `max` to `high` (105%).
                # 91% -> 4.84. 105% -> 5.58.
                # Higher % = Higher Value. This confirms it varies directly with Intensity.
                # Speed varies directly with Intensity. Pace varies inversely.
                # THEREFORE: If Min < Max, it MUST be Speed (or Power).
                # If it were Pace, 91% would be a SLOWER pace (higher number) than 105%?
                # Wait. 105% of Critical Speed is FASTER. 
                # If expressed as Pace: 105% -> 3:00/km. 91% -> 3:30/km.
                # So 105% (High Intensity) would have a LOWER numeric value.
                
                # Conclusion:
                # If target_min (linked to low %) < target_max (linked to high %), it is SPEED.
                # If target_min (linked to low %) > target_max (linked to high %), it is PACE.
                
                # However, we only have min/max values here, not strictly linked to % in this scope (unless we passed step).
                # But Nolio names them "min" and "max".
                # If t_min < t_max, and it's in realistic range, assume Speed (m/s) IF type is ambiguous.
                
                if t_max_val and t_min_val < t_max_val:
                    # Min < Max -> Likely Speed (m/s)
                    # But verify if converted Pace is also realistic?
                    # 4.84 m/s is realistic.
                    target_min = t_min_val
                    target_max = t_max_val
                    target_type = "speed" # Correct the type
                else:
                    # Min > Max (or only Min provided), assume Pace
                    target_min = convert_pace_to_speed(t_min_val)
                    target_max = convert_pace_to_speed(t_max_val) if t_max_val else None
                    target_type = "speed"

            # Ensure Min < Max (Speed is inverse of Pace)
            if target_min and target_max and float(target_min) > float(target_max):
                target_min, target_max = target_max, target_min
        
        # 2. Extract Duration (using Target Speed if available)
        duration = 0
        dur_type = step.get("step_duration_type", "duration")
        distance_m = 0
        
        if dur_type == "duration":
            duration = float(step.get("step_duration_value", 0))
        elif dur_type == "distance":
            distance_m = float(step.get("step_duration_value", 0))
            
            # Smart Estimation using Target Speed
            estimated_speed = 0
            if target_type == "speed" and target_min:
                t_min = float(target_min)
                t_max = float(target_max) if target_max else t_min
                estimated_speed = (t_min + t_max) / 2.0
            
            if estimated_speed > 0:
                duration = distance_m / estimated_speed
            else:
                # Fallback to defaults
                factor = 0.24 # Default Run (4:00/km)
                step_name = step.get("name", "").lower()
                s_type = getattr(self, 'sport_type', 'run')
                
                if any(kw in step_name for kw in ["natation", "swimming", "swim"]) or "swim" in s_type:
                    factor = 0.9 # 1:30/100m
                elif any(kw in step_name for kw in ["vélo", "bike", "cyclisme"]) or "bike" in s_type:
                    factor = 0.12 # 30km/h
                
                duration = distance_m * factor
        
        return {
            "type": step.get("intensity_type", "active"),
            "name": step.get("name", ""),
            "duration": duration,
            "distance_m": distance_m,
            "target_min": target_min,
            "target_max": target_max,
            "target_type": target_type
        }

class TextPlanParser:
    """
    Parses workout titles using regex patterns to extract interval structure.

    Supported formats:
    - Simple: "10*1km", "6*4'", "15*3' Z2/ r 1'"
    - Composite distance: "5*(500m Z3 + 1000m Z2)"
    - Composite time: "5*2' Z3 + 3' Z2" (parsed as 5 composite blocks)
    - HIT format: "(20*10-50)" means 20 intervals of 10s work / 50s rest
    """

    def parse(self, title: str) -> List[Dict[str, Any]]:
        """
        Parses a title string and returns a list of interval dicts.
        """
        if not title:
            return []

        title_lower = title.lower()
        intervals = []

        # ===== NEW PATTERN 0a: Composite distance in parentheses =====
        # Example: "5*(500m Z3 + 1000m Z2)" → 5 composite blocks
        composite_dist_match = re.search(
            r'(\d+)\s*[x*]\s*\(\s*(\d+)\s*m[^+]*\+\s*(\d+)\s*m',
            title_lower
        )
        if composite_dist_match:
            count = int(composite_dist_match.group(1))
            dist1 = float(composite_dist_match.group(2))
            dist2 = float(composite_dist_match.group(3))
            total_dist = dist1 + dist2

            # Estimate duration (4:00/km = 0.24 s/m)
            est_duration = total_dist * 0.24

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "distance_m": total_dist,
                    "duration": est_duration,
                    "target_type": "distance",
                    "is_composite": True,
                    "components": [
                        {"distance_m": dist1},
                        {"distance_m": dist2}
                    ]
                })
            return intervals

        # ===== NEW PATTERN 0b: Composite time with "+" =====
        # Example: "5*2' Z3 + 3' Z2" → 5 composite blocks of 5 min each
        composite_time_match = re.search(
            r'(\d+)\s*[x*]\s*(\d+)\s*([\'"])\s*[^+]*\+\s*(\d+)\s*([\'""])',
            title_lower
        )
        if composite_time_match:
            count = int(composite_time_match.group(1))
            dur1_val = float(composite_time_match.group(2))
            dur1_unit = composite_time_match.group(3)
            dur2_val = float(composite_time_match.group(4))
            dur2_unit = composite_time_match.group(5)

            dur1 = self._parse_duration(dur1_val, dur1_unit)
            dur2 = self._parse_duration(dur2_val, dur2_unit)
            total_dur = dur1 + dur2

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "duration": total_dur,
                    "target_type": "time",
                    "is_composite": True,
                    "components": [
                        {"duration": dur1},
                        {"duration": dur2}
                    ]
                })
            return intervals

        # ===== NEW PATTERN 0c: HIT format (N*work-rest) =====
        # Handles both single and multiple HIT blocks
        # Examples:
        #   "(20*10-50)" → 20 intervals of 10s work
        #   "20*10-50" → 20 intervals of 10s work
        #   "LIT + HIT (20*10-50) + (20*15-45) + (20*10-50)" → 60 intervals

        # First check for multiple HIT blocks in parentheses
        multi_hit_matches = re.findall(
            r'\((\d+)\s*[x*]\s*(\d+)\s*-\s*(\d+)\)',
            title_lower
        )
        if multi_hit_matches and len(multi_hit_matches) > 1:
            # Multiple HIT blocks found
            for match in multi_hit_matches:
                count = int(match[0])
                work_dur = float(match[1])

                for _ in range(count):
                    intervals.append({
                        "type": "active",
                        "duration": work_dur,
                        "target_type": "time"
                    })
            return intervals

        # Single HIT pattern (with or without parentheses)
        hit_match = re.search(
            r'\(?(\d+)\s*[x*]\s*(\d+)\s*-\s*(\d+)\)?',
            title_lower
        )
        if hit_match:
            # Check if this is really HIT (short durations) vs tempo (longer)
            count = int(hit_match.group(1))
            work_dur = float(hit_match.group(2))
            rest_dur = float(hit_match.group(3))

            # HIT is typically < 60s work, tempo is longer
            if work_dur <= 60 and rest_dur <= 120:
                for _ in range(count):
                    intervals.append({
                        "type": "active",
                        "duration": work_dur,
                        "target_type": "time"
                    })
                return intervals

        # ===== NEW PATTERN 0d: Multi-block distance (reps + long tempo) =====
        # Examples:
        #   "5*1Km seuil + 9Km Tempo"
        #   "21Km : 5*1Km seuil + 9Km Tempo"
        multi_block_dist_match = re.search(
            r'(\d+)\s*[x*]\s*([\d\.]+)\s*(k?m)\b[^+]*\+\s*([\d\.]+)\s*(k?m)\b',
            title_lower
        )
        if multi_block_dist_match:
            count = int(multi_block_dist_match.group(1))
            rep_val = float(multi_block_dist_match.group(2))
            rep_unit = multi_block_dist_match.group(3)
            tail_val = float(multi_block_dist_match.group(4))
            tail_unit = multi_block_dist_match.group(5)

            rep_dist_m = self._parse_distance(rep_val, rep_unit)
            tail_dist_m = self._parse_distance(tail_val, tail_unit)
            if rep_dist_m > 0 and tail_dist_m > 0:
                rep_duration = rep_dist_m * 0.24
                tail_duration = tail_dist_m * 0.24
                for _ in range(count):
                    intervals.append({
                        "type": "active",
                        "distance_m": rep_dist_m,
                        "duration": rep_duration,
                        "target_type": "distance"
                    })
                intervals.append({
                    "type": "active",
                    "distance_m": tail_dist_m,
                    "duration": tail_duration,
                    "target_type": "distance"
                })
                return intervals

        # ===== NEW PATTERN 0e: Additive distance blocks (NKm + NKm [+ NKm]) =====
        # Examples:
        #   "30Km : 9Km à 80-85% + 9Km à 86-90% + 9Km à 91-95%" → 3 targets, 9000m each
        #   "40Km : 32Km Tempo + 4Km Z2" → 2 targets, 32000m + 4000m
        # No repetition marker (N*) — each block is a standalone distance target
        additive_blocks = re.findall(r'(\d+)\s*km\b', title_lower)
        if len(additive_blocks) >= 3 and '+' in title_lower:
            parts = [p.strip() for p in title_lower.split('+')]
            block_distances = []
            for idx, part in enumerate(parts):
                dm = re.findall(r'(\d+)\s*km', part)
                if dm:
                    # For first part, take LAST match (skip header like "30Km :")
                    dist_val = int(dm[-1]) if idx == 0 else int(dm[0])
                    block_distances.append(dist_val * 1000)

            if len(block_distances) >= 2:
                for dist_m in block_distances:
                    intervals.append({
                        "type": "active",
                        "distance_m": dist_m,
                        "duration": dist_m * 0.24,  # estimate ~4:00/km
                        "target_type": "distance"
                    })
                return intervals

        # ===== ORIGINAL PATTERN 1: Nx Distance =====
        # (e.g. 3x 2000m, 8*1km, 20x500)
        # Guard: avoid capturing time formats like 10x30/30 or 6*4'
        dist_match = re.search(r'(\d+)\s*[x*]\s*([\d\.]+)\s*(km|m)\b', title_lower)
        if not dist_match:
            dist_match = re.search(r'(\d+)\s*[x*]\s*([\d\.]+)\b(?!\s*[\'"/])', title_lower)
        if dist_match:
            count = int(dist_match.group(1))
            val = float(dist_match.group(2))
            unit = dist_match.group(3)  # May be None if no unit

            dist_m = val
            if unit == 'km':
                dist_m = val * 1000
            elif unit == 'm':
                dist_m = val
            elif unit is None:
                # No unit specified - infer from value
                # >= 100 = meters, < 100 = likely km or invalid
                if val >= 100:
                    dist_m = val  # e.g., "500" -> 500m
                else:
                    dist_m = val * 1000  # e.g., "2" -> 2km

            # Estimate Duration (Default Run: 4:00/km = 0.24 s/m)
            est_duration = dist_m * 0.24

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "distance_m": dist_m,
                    "duration": est_duration,
                    "target_type": "distance"
                })
            return intervals

        # ===== PATTERN 2a: Nx Compound Duration (e.g. 20*1'30'' / r 45'') =====
        # Handles M'S'' format (minutes and seconds combined)
        compound_match = re.search(
            r'(\d+)\s*[x*]\s*(\d+)[\'′](\d+)[\'″"\'\']',
            title_lower
        )
        if compound_match:
            count = int(compound_match.group(1))
            minutes = float(compound_match.group(2))
            seconds = float(compound_match.group(3))
            dur_on = minutes * 60 + seconds

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "duration": dur_on,
                    "target_type": "time"
                })
            return intervals

        # ===== ORIGINAL PATTERN 2: Nx A/B (Interval/Rest) =====
        on_off_match = re.search(r'(\d+)\s*[x*]\s*([\d\.]+)([\'"mns]*)\s*/\s*([\d\.]+)([\'"mns]*)', title_lower)
        if on_off_match:
            count = int(on_off_match.group(1))
            val_on = float(on_off_match.group(2))
            unit_on = on_off_match.group(3)

            dur_on = self._parse_duration(val_on, unit_on)

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "duration": dur_on,
                    "target_type": "time"
                })
            return intervals

        # ===== ORIGINAL PATTERN 3: Nx Time (e.g. 6*4', 10x 30") =====
        time_match = re.search(r'(\d+)\s*[x*]\s*([\d\.]+)\s*([\'"mns]+)', title_lower)
        if time_match:
            count = int(time_match.group(1))
            val = float(time_match.group(2))
            unit = time_match.group(3)

            dur = self._parse_duration(val, unit)

            for _ in range(count):
                intervals.append({
                    "type": "active",
                    "duration": dur,
                    "target_type": "time"
                })
            return intervals

        return []

    def _parse_duration(self, val: float, unit: str) -> float:
        unit = unit.strip()
        if unit in ["'", "min", "m", "mn"]:
             return val * 60
        if unit in ['"', "s", "sec", ""]:
             return val
        return val

    def _parse_distance(self, val: float, unit: str) -> float:
        unit = (unit or "").strip().lower()
        if unit == "km":
            return val * 1000
        if unit == "m":
            return val
        return val if val >= 100 else val * 1000
