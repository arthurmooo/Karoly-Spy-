import re
from typing import List, Dict, Any, Optional

class ActivityClassifier:
    """
    Handles activity type detection and metadata parsing for segmentation.
    """
    
    COMPETITION_KEYWORDS = [
        r"marathon", r"semi", r"10k", r"course", r"race", r"compétition", 
        r"90", r"180", r"ironman", r"triathlon"
    ]

    def is_competition(self, title: str, nolio_type: str) -> bool:
        """
        Detects if an activity is a competition based on Nolio type or keywords in title.
        """
        if nolio_type and nolio_type.lower() in ["compétition", "race", "competition"]:
            return True
            
        combined_text = title.lower()
        for kw in self.COMPETITION_KEYWORDS:
            if re.search(kw, combined_text):
                return True
                
        return False

    def parse_splits(self, comment: str) -> List[Dict[str, Any]]:
        """
        Parses #split tags from Nolio comments.
        Format: #split: 0-10, 10-20 (km) or #split: 00:00-00:10, 00:10-00:20 (time)
        """
        if not comment or "#split:" not in comment:
            return []
            
        # Extract the part after #split:
        match = re.search(r"#split:\s*(.*)", comment, re.IGNORECASE)
        if not match:
            return []
            
        raw_splits = match.group(1).split(",")
        parsed_splits = []
        
        for s in raw_splits:
            s = s.strip()
            # Try to match time format (HH:MM:SS or MM:SS)
            time_match = re.findall(r"(\d{1,2}:)?\d{1,2}:\d{2}", s)
            if time_match:
                # Time processing
                parts = s.split("-")
                if len(parts) == 2:
                    parsed_splits.append({
                        "start": self._time_to_seconds(parts[0].strip()),
                        "end": self._time_to_seconds(parts[1].strip()),
                        "unit": "time"
                    })
            else:
                # Distance processing (numbers)
                parts = re.findall(r"(\d+\.?\d*)", s)
                if len(parts) == 2:
                    parsed_splits.append({
                        "start": float(parts[0]),
                        "end": float(parts[1]),
                        "unit": "km"
                    })
                    
        return parsed_splits

    def _time_to_seconds(self, t_str: str) -> int:
        """Converts HH:MM:SS or MM:SS to seconds."""
        parts = list(map(int, t_str.split(":")))
        if len(parts) == 3: # HH:MM:SS
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        elif len(parts) == 2: # MM:SS
            return parts[0] * 60 + parts[1]
        return 0

    def get_strategy(self, title: str, nolio_type: str, comment: str) -> str:
        """
        Determines the segmentation strategy to use.
        """
        if self.parse_splits(comment):
            return "manual"
            
        if self.is_competition(title, nolio_type):
            return "auto_competition"
            
        return "auto_training"
