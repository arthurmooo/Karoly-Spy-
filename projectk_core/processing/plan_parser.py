import re
from typing import Dict, Optional, Any

class NolioPlanParser:
    """
    Parses Nolio workout titles to extract interval structure.
    Examples:
    - "3*15' Z2" -> {"type": "time", "duration": 900, "reps": 3}
    - "10x400m" -> {"type": "distance", "duration": 400, "reps": 10}
    - "6x30\"" -> {"type": "time", "duration": 30, "reps": 6}
    """

    @staticmethod
    def parse(title: str) -> Optional[Dict[str, Any]]:
        if not title:
            return None
            
        # Normalize title
        text = title.lower().replace(" ", "")
        
        # Pattern 1: Time-based (Minutes) -> 3*15' or 3x15'
        # Group 1: Reps, Group 2: Duration (min)
        match_min = re.search(r"(\d+)[x*](\d+)'", text)
        if match_min:
            reps = int(match_min.group(1))
            duration_min = int(match_min.group(2))
            return {
                "type": "time",
                "duration": duration_min * 60,
                "reps": reps,
                "unit": "s"
            }

        # Pattern 2: Time-based (Seconds) -> 10x30" or 10*30"
        match_sec = re.search(r"(\d+)[x*](\d+)\"", text)
        if match_sec:
            reps = int(match_sec.group(1))
            duration_sec = int(match_sec.group(2))
            return {
                "type": "time",
                "duration": duration_sec,
                "reps": reps,
                "unit": "s"
            }

        # Pattern 3: Distance-based -> 10x400m or 10*400m
        match_dist = re.search(r"(\d+)[x*](\d+)m", text)
        if match_dist:
            reps = int(match_dist.group(1))
            dist = int(match_dist.group(2))
            return {
                "type": "distance",
                "duration": dist,
                "reps": reps,
                "unit": "m"
            }
            
        return None

    @staticmethod
    def parse_json_structure(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Deep parses the structured_workout JSON from Nolio.
        Looks for the dominant 'set' (repeating block).
        """
        if not data or 'structured_workout' not in data:
            return None
            
        structure = data['structured_workout']
        if not isinstance(structure, list):
            return None
            
        # Recursive search for the main set
        def find_main_set(items):
            for item in items:
                # In Nolio, 'set' is often a type with 'repetitions' > 1
                if item.get('repetitions', 1) > 1:
                    # Find duration of the 'work' block inside the set
                    content = item.get('content', [])
                    for sub in content:
                        # Identify work step (usually non-recovery)
                        # Nolio uses 'type': 'work' or 'step'
                        if sub.get('type') == 'step' and sub.get('duration'):
                            return {
                                "type": "time",
                                "duration": int(sub['duration']),
                                "reps": int(item['repetitions']),
                                "unit": "s"
                            }
                
                # Check nested content
                if 'content' in item:
                    res = find_main_set(item['content'])
                    if res: return res
            return None

        return find_main_set(structure)
