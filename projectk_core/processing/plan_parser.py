from typing import List, Dict, Any, Union

class NolioPlanParser:
    """
    Parses Nolio structured workout JSON to extract a linear 'Target Grid' of intervals.
    Handles nested repetitions and complex wave structures.
    """

    def parse(self, structure: Union[Dict[str, Any], List[Any]]) -> List[Dict[str, Any]]:
        """
        Main entry point. Flattens the structure into a list of active intervals.
        """
        steps = []
        
        # Normalize input to a list of steps/blocks
        if isinstance(structure, dict):
            # CRITICAL FIX: If the dict IS a block (has 'type'), treat it as an item.
            # Only drill down if it's a generic container like {"structured_workout": [...]}
            # But the spec says input is the JSON from API.
            # Nolio API usually returns a list for 'structured_workout'.
            # But if we pass a single dict (like in unit tests), we must treat it as one item.
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
        # Filter for active/ramp_up
        if intensity not in ["active", "ramp_up"]:
            return False
        
        # Heuristic: If a step is labeled 'warmup' or 'cooldown' in its name, it's not a work interval
        name = step.get("name", "").lower()
        if "échauffement" in name or "echauffement" in name or "warmup" in name or "récupération" in name or "cooldown" in name:
            # But wait, some people use "Active Warmup". 
            # Usually, work intervals have a specific target.
            pass

        return True

    def _extract_interval_data(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts standardized data from a step."""
        # Duration
        duration = 0
        dur_type = step.get("step_duration_type", "duration")
        
        if dur_type == "duration":
            duration = float(step.get("step_duration_value", 0))
        elif dur_type == "distance":
            # Estimate duration based on a default pace if distance (e.g., 4:00/km -> 240s/km)
            distance_m = float(step.get("step_duration_value", 0))
            # We don't have the athlete's pace here easily, so we store distance
            # For now, let's use a dummy 4:00/km (15km/h) for estimation if needed,
            # but better to just flag it as distance-based.
            duration = distance_m * 0.24 # 1000m -> 240s
            
        # Target
        target_min = step.get("target_value_min")
        target_max = step.get("target_value_max")
        target_type = step.get("target_type") 
        
        return {
            "type": step.get("intensity_type", "active"),
            "name": step.get("name", ""),
            "duration": duration,
            "distance_m": float(step.get("step_duration_value", 0)) if dur_type == "distance" else 0,
            "target_min": target_min,
            "target_max": target_max,
            "target_type": target_type
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

            return intensity in ["active", "ramp_up"]

    

        def _extract_interval_data(self, step: Dict[str, Any]) -> Dict[str, Any]:

            """Extracts standardized data from a step."""

            # Duration

            duration = 0

            dur_type = step.get("step_duration_type", "duration") # Default to duration if missing

            

            if dur_type == "duration":

                duration = float(step.get("step_duration_value", 0))

            elif dur_type == "distance":

                pass # Distance logic later

                

            # Target

            target_min = step.get("target_value_min")

            target_max = step.get("target_value_max")

            target_type = step.get("target_type") 

            

            return {

                "type": step.get("intensity_type", "active"),

                "duration": duration,

                "target_min": target_min,

                "target_max": target_max,

                "target_type": target_type

            }

    