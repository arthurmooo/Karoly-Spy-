from typing import List, Dict, Any, Union

class NolioPlanParser:
    """
    Parses Nolio structured workout JSON to extract a linear 'Target Grid' of intervals.
    Handles nested repetitions and complex wave structures.
    """

    def parse(self, structure: Union[Dict[str, Any], List[Any]], sport_type: str = "run") -> List[Dict[str, Any]]:
        """
        Main entry point. Flattens the structure into a list of active intervals.
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
                    
        return target_grid

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
        # Include 'active' and 'ramp_up' as work intervals.
        return intensity in ["active", "ramp_up"]

    def _extract_interval_data(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts standardized data from a step."""
        # Duration
        duration = 0
        dur_type = step.get("step_duration_type", "duration")
        
        if dur_type == "duration":
            duration = float(step.get("step_duration_value", 0))
        elif dur_type == "distance":
            # Estimate duration based on sport default pace
            distance_m = float(step.get("step_duration_value", 0))
            factor = 0.24 # Default Run (4:00/km)
            
            # Refine factor based on sport or step name
            step_name = step.get("name", "").lower()
            s_type = getattr(self, 'sport_type', 'run')
            
            if any(kw in step_name for kw in ["natation", "swimming", "swim"]) or "swim" in s_type:
                factor = 0.9 # 1:30/100m
            elif any(kw in step_name for kw in ["vélo", "bike", "cyclisme"]) or "bike" in s_type:
                factor = 0.12 # 30km/h
            
            duration = distance_m * factor
            
        # Target
        target_min = step.get("target_value_min")
        target_max = step.get("target_value_max")
        target_type = step.get("target_type") 
        
        # Convert Target values to Speed (m/s) if they look like Pace
        if target_type == "pace":
            t_min_val = float(target_min or 0)
            t_max_val = float(target_max or 0)
            
            # IMPROVED HEURISTIC:
            # The challenge: Nolio API can send pace as:
            # - km/h (>10): e.g., 18.5 km/h
            # - min/km (<2.5): e.g., 3.0 min/km = 5.55 m/s  
            # - m/s (2.5-10): e.g., 5.14 m/s
            #
            # The key insight: a realistic running speed is between 1.5 m/s (11:00/km) 
            # and 6.5 m/s (2:34/km). If treating the value as m/s gives a realistic
            # speed, we keep it. Otherwise, we try to convert.
            
            def is_realistic_speed(val):
                """Check if value represents a realistic running/cycling speed in m/s."""
                # 1.5 m/s = 11:00/km (slow jog), 6.5 m/s = 2:34/km (elite sprinting)
                return 1.5 <= val <= 6.5
            
            def convert_pace_to_speed(val):
                """Convert min/km to m/s. E.g., 3.0 min/km -> 5.55 m/s"""
                if val <= 0:
                    return 0
                return 1000.0 / (val * 60.0)
            
            def convert_kmh_to_speed(val):
                """Convert km/h to m/s. E.g., 18 km/h -> 5.0 m/s"""
                return val / 3.6
            
            # Clear case: > 10 = definitely km/h
            if t_min_val > 10.0:
                target_min = convert_kmh_to_speed(t_min_val)
                target_max = convert_kmh_to_speed(t_max_val) if t_max_val else None
            
            # Clear case: < 2.0 = definitely min/km (nobody runs at 1.5 m/s for intervals)
            elif t_min_val < 2.0:
                target_min = convert_pace_to_speed(t_min_val)
                target_max = convert_pace_to_speed(t_max_val) if t_max_val else None
            
            # Ambiguous zone (2.0 - 10.0): check if it's a realistic speed
            elif is_realistic_speed(t_min_val):
                # Already m/s - keep as is
                pass
            
            # Not realistic as m/s, try converting from min/km
            else:
                converted = convert_pace_to_speed(t_min_val)
                if is_realistic_speed(converted):
                    target_min = converted
                    target_max = convert_pace_to_speed(t_max_val) if t_max_val else None
                # If still not realistic, keep original (let matcher handle it)
            
            target_type = "speed"
            
            # Ensure min < max
            if target_min and target_max and float(target_min) > float(target_max):
                target_min, target_max = target_max, target_min
        
        return {
            "type": step.get("intensity_type", "active"),
            "name": step.get("name", ""),
            "duration": duration,
            "distance_m": float(step.get("step_duration_value", 0)) if dur_type == "distance" else 0,
            "target_min": target_min,
            "target_max": target_max,
            "target_type": target_type
        }
