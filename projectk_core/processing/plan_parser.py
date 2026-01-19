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
        # Filter for active/ramp_up
        if intensity not in ["active", "ramp_up"]:
            return False
        
        # Heuristic: If a step is labeled 'warmup' or 'cooldown' in its name, it's not a work interval
        name = step.get("name", "").lower()
        if "échauffement" in name or "echauffement" in name or "warmup" in name or "récupération" in name or "cooldown" in name:
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
            # Estimate duration based on sport default pace
            distance_m = float(step.get("step_duration_value", 0))
            factor = 0.24 # Default Run (4:00/km)
            
            # Refine factor based on sport or step name
            step_name = step.get("name", "").lower()
            s_type = getattr(self, 'sport_type', 'run')
            
            if "natation" in step_name or "swimming" in step_name or "swim" in s_type:
                factor = 1.0 # 100s/100m (1:40/100m) -> 1.0 s/m is a bit slow? 
                             # 1:30/100m = 90s/100m = 0.9 s/m. 
                             # Let's use 0.9 as a good amateur swimmer baseline.
                factor = 0.9
            elif "vélo" in step_name or "bike" in step_name or "cyclisme" in step_name or "bike" in s_type:
                factor = 0.12 # 30km/h = 120s/km = 0.12 s/m
            
            duration = distance_m * factor
            
        # Target
        target_min = step.get("target_value_min")
        target_max = step.get("target_value_max")
        target_type = step.get("target_type") 
        
        # Convert Pace (min/km) to Speed (m/s) for consistency
        if target_type == "pace":
            if target_min and target_min > 0:
                # 4.5 min/km -> 4.5 * 60 = 270s/km. 1000/270 = 3.7 m/s
                target_min = 1000.0 / (float(target_min) * 60.0)
            if target_max and target_max > 0:
                target_max = 1000.0 / (float(target_max) * 60.0)
            target_type = "speed" # Rename type to match signal
            
            # Swap Min/Max because Pace is inverse to Speed (Lower Pace = Higher Speed)
            # If original min=4.5 (slower) and max=4.0 (faster)
            # Converted min=3.7 (slower) and max=4.1 (faster)
            # Actually, usually min is the lower bound of the ZONE.
            # For Pace: 4:30 - 4:00. Min=4:00 (Fast), Max=4:30 (Slow)? No, usually numeric min/max.
            # If Nolio sends min=4.0 and max=4.5. 
            # Speed min should be speed(4.5) and Speed max speed(4.0).
            if target_min and target_max and target_min > target_max:
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

    