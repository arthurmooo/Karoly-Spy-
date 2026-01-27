import re
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

class ActivityClassifier:
    """
    Handles activity type detection and metadata parsing for segmentation.
    """
    
    COMPETITION_KEYWORDS = [
        r"marathon", r"semi", r"\b10k\b", r"race", r"compétition", 
        r"ironman", r"triathlon", r"championnat", r"corrida", r"cross\b", r"cyclosportive",
        r"run\s+and\s+bike", r"run\s+&\s+bike"
    ]
    
    INTERVAL_KEYWORDS = [
        r"\d+\s*[*x]\s*\d+", r"vma", r"seuil", r"bloc", r"fractionné", r"sprint",
        r"\d+([-]\d+)?\s*%", r"\d+\s*[*x]\s*\(", r"\b30[-/]30\b", r"test\s+\d+",
        r"\d+'/\d+''", r"\d+''/\d+''", r"piste", r"\bhit\b",
        r"\d+\s*-\s*\d+\s*-\s*r\s*-\s*\d+", # 6-4-r-2
        r"\d+'\s*-\s*\d+'", # 1'-1'
        r"\btempo\b", r"\bz[345]\b", r"\blt[12]\b", r"allure\s+course", r"travail\s+spé"
    ]

    ENDURANCE_KEYWORDS = [
        r"échauffement", r"récupération", r"récup\b", r"cool\s*down", r"décrassage",
        r"footing", r"endurance\s+fondamentale", r"ef\b", r"\blit\b",
        r"tapis", r"roulant",
        r"sortie vélo", r"course à pied.*(matinale|matin|après-midi|soir)", r"natation (matinale|matin|après-midi|soir)"
    ]

    def detect_work_type(self, df: pd.DataFrame, title: str, nolio_type: str, sport_name: str = "", target_grid: Optional[List[Dict[str, Any]]] = None, is_competition_nolio: bool = False, laps: Optional[List[Dict[str, Any]]] = None) -> str:
        """
        Classifies activity as 'endurance', 'intervals', or 'competition'.
        """
        combined_text = title.lower()
        clean_title = title.strip().lower()
        clean_nolio_type = nolio_type.strip().lower() if nolio_type else ""

        # 0. Force Endurance for specific sports OR LIT priority
        # Exception: if HIT is also present, it stays as intervals (user request 2026-01-25)
        is_lit = re.search(r"\blit\b", combined_text)
        is_hit = re.search(r"\bhit\b", combined_text)
        
        if sport_name in ["Strength", "Other"] or (is_lit and not is_hit):
            return "endurance"

        # 1. Explicit Competition (Nolio Flag or Type)
        if is_competition_nolio or (clean_nolio_type in ["compétition", "race", "competition"]):
            return "competition"

        # 2. Intervals (Strategy A: Plan-Driven)
        if target_grid and len(target_grid) > 0:
            # If there's only one block, check if it's really an interval block
            # (e.g. name contains interval keywords) or if it's just one big endurance block.
            if len(target_grid) > 1:
                return "intervals"
            
            # Single block case: check name for interval keywords
            single_block_name = target_grid[0].get("name", "").lower()
            is_single_block_interval = False
            for kw in self.INTERVAL_KEYWORDS:
                if re.search(kw, single_block_name):
                    is_single_block_interval = True
                    break
            
            if is_single_block_interval:
                return "intervals"
            
            # If single block and NO interval keywords in its name, 
            # we don't automatically return "intervals". 
            # We continue to other checks (keywords in title, CV, etc.)

        # 3. Check for Generic Title (e.g. Title contains only the sport name)
        # If the title is just the sport and there's no plan, it's very likely generic endurance
        generic_titles = [
            "course à pied", "vélo", "ski de fond", "natation", "ski de randonnée",
            "vélo - route", "vélo - home trainer", "trail", "course à pied - tapis",
            "renforcement musculaire", "musculation", "ppg", "gainage", "randonnée", 
            "vtt", "marche", "natation en eau libre", "ski de rando", "cyclisme",
            "vélo - gravel", "gravel"
        ]
        
        # If title is exactly sport name (from internal mapping or Nolio type)
        is_generic = (clean_title == sport_name.lower()) or \
                     (clean_title == clean_nolio_type) or \
                     (clean_title in generic_titles)

        if is_generic:
            if not target_grid:
                return "endurance"

        # 4. Intervals (Strategy B: Keywords)
        is_interval_by_kw = False
        for kw in self.INTERVAL_KEYWORDS:
            if re.search(kw, combined_text):
                is_interval_by_kw = True
                break

        # 5. Endurance Keywords (High priority if no explicit intervals)
        is_endurance_by_kw = False
        for kw in self.ENDURANCE_KEYWORDS:
            if re.search(kw, combined_text):
                is_endurance_by_kw = True
                break
        
        if is_endurance_by_kw and not is_interval_by_kw:
            return "endurance"
        
        if is_interval_by_kw:
            return "intervals"

        # 6. Competition (Strategy C: Keywords in Title)
        for kw in self.COMPETITION_KEYWORDS:
            if re.search(kw, combined_text):
                return "competition"

        # 7. Intelligent Lap Filtering (Strategy B)
        if laps and len(laps) > 1:
            is_endurance_by_laps = self._check_auto_laps(laps, sport_name)
            if is_endurance_by_laps:
                return "endurance"

        # 8. Signal Variability (LAST RESORT, more conservative)
        signal = None
        if df is not None and not df.empty:
            if 'power' in df.columns and df['power'].mean() > 0:
                signal = df['power']
            elif 'speed' in df.columns and df['speed'].mean() > 0:
                signal = df['speed']

        if signal is not None:
            mean_val = signal.mean()
            if mean_val > 0:
                cv = signal.std() / mean_val
                
                # Much higher thresholds to avoid false positives on generic mountain sessions
                threshold = 0.40 # Default 40%
                if any(k in combined_text for k in ["ski", "trail", "rando", "montagne"]):
                    threshold = 0.60 # Extremely high for mountain sports
                
                if cv > threshold:
                    return "intervals"
        
        return "endurance"

    def _check_auto_laps(self, laps: List[Dict[str, Any]], sport_name: str) -> bool:
        """
        Returns True if laps look like device Auto-Laps (Endurance).
        """
        if not laps:
            return False
            
        sport = sport_name.lower()
        technical_distances = []
        if any(s in sport for s in ["run", "bike", "vélo", "cyclisme", "trail"]):
            technical_distances = [1000, 5000]
        elif any(s in sport for s in ["swim", "natation"]):
            technical_distances = [50, 100, 200, 400]
            
        if not technical_distances:
            return False
            
        remaining_laps = []
        for lap in laps:
            dist = lap.get("total_distance") or 0
            is_tech = False
            for td in technical_distances:
                if abs(dist - td) <= td * 0.015: # 1.5% tolerance
                    is_tech = True
                    break
            if not is_tech:
                remaining_laps.append(lap)
        
        # If all laps were technical -> Endurance
        if not remaining_laps:
            return True
            
        # If some laps remain, check their duration variance
        # If variance is very low, it's likely still endurance with weird lap distances
        durations = [l.get("total_timer_time") or l.get("duration") or 0 for l in laps]
        durations = [d for d in durations if d > 0]
        
        if len(durations) > 1:
            mean_dur = sum(durations) / len(durations)
            std_dur = (sum((d - mean_dur) ** 2 for d in durations) / len(durations)) ** 0.5
            cv = std_dur / mean_dur if mean_dur > 0 else 0
            
            if cv < 0.05: # 5% variance threshold
                return True
                
        return False

    def is_competition(self, title: str, nolio_type: str, is_competition_nolio: bool = False) -> bool:
        """
        Detects if an activity is a competition based on Nolio flag, type or keywords in title.
        """
        combined_text = title.lower()
        
        # 0. LIT Priority (overrides everything)
        if re.search(r"\blit\b", combined_text):
            return False

        if is_competition_nolio:
            return True

        if nolio_type and nolio_type.lower() in ["compétition", "race", "competition"]:
            return True

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

    def get_strategy(self, title: str, nolio_type: str, comment: str, is_competition_nolio: bool = False) -> str:
        """
        Determines the segmentation strategy to use.
        """
        if self.parse_splits(comment):
            return "manual"
            
        if self.is_competition(title, nolio_type, is_competition_nolio):
            return "auto_competition"
            
        return "auto_training"
