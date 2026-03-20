"""
Centralized sport mapping module.

Converts Nolio sport names and sport_ids to internal categories:
Run, Bike, Swim, Ski, Strength, Other.
"""

from typing import Optional

# Primary mapping: sport_id → internal category (most reliable)
SPORT_ID_MAP: dict[int, str] = {
    2:  "Run",       # Running
    3:  "Ski",       # XC ski - Classic
    4:  "Ski",       # XC ski - Skating
    5:  "Ski",       # Roller ski - Classic
    6:  "Ski",       # Roller ski - Skating
    7:  "Ski",       # Ski Mountaineering (= Ski de randonnée)
    8:  "Other",     # Climbing
    10: "Strength",  # Bodybuilding
    12: "Other",     # Other
    14: "Bike",      # Road cycling
    15: "Bike",      # Mountain cycling
    16: "Run",       # Hiking
    18: "Bike",      # Virtual ride
    19: "Swim",      # Swimming
    20: "Strength",  # Strength
    21: "Strength",  # Stretching
    24: "Run",       # Treadmill
    26: "Other",     # Kayaking - Sea
    27: "Other",     # Kayaking - River
    28: "Strength",  # Elliptical trainer
    29: "Run",       # Walking sticks (Nordic walking)
    30: "Strength",  # Yoga
    31: "Other",     # Canoe - Sea
    32: "Other",     # Canoe - River
    33: "Other",     # Rowing
    34: "Run",       # Orienteering race
    35: "Bike",      # Track cycling
    36: "Bike",      # CX cycling
    37: "Other",     # Squash
    38: "Ski",       # Biathlon
    45: "Run",       # Walking
    51: "Other",     # Stand up paddle
    52: "Run",       # Trail running
    53: "Run",       # OCR running
    59: "Other",     # Tennis
}

# Fallback string matching rules. Order matters: Ski BEFORE Run
# so "Ski de randonnée" matches Ski, not Run via "Randonnée".
SPORT_STRING_RULES: list[tuple[str, list[str]]] = [
    ("Bike", [
        "Vélo", "Cyclisme", "VTT", "Cycling", "Road cycling", "Virtual ride",
        "Mountain cycling", "Gravel", "Track cycling", "CX cycling", "Cyclocross",
        "Biking",
    ]),
    ("Swim", ["Natation", "Swimming", "Nage"]),
    ("Ski", [
        "Ski de randonnée", "Ski de rando", "Ski de fond", "Biathlon",
        "Roller ski", "XC ski", "Ski alpin",
    ]),
    ("Strength", [
        "Renforcement musculaire", "Musculation", "PPG", "Strength",
        "Gainage", "Stretching", "Yoga", "Elliptique",
    ]),
    ("Run", [
        "Course à pied", "Running", "Trail", "Jogging", "Treadmill",
        "Tapis", "Randonnée", "Rando", "Hiking", "Marche", "Walking",
        "Orienteering",
    ]),
]


INTERNAL_CATEGORIES = {"Run", "Bike", "Swim", "Ski", "Strength", "Other"}


def normalize_sport(sport_name: str, sport_id: Optional[int] = None) -> str:
    """Return internal sport category (Run/Bike/Swim/Ski/Strength/Other).

    Priority:
      1. sport_id lookup (most reliable, from Nolio API)
      2. Identity check (input is already an internal category)
      3. String keyword matching (fallback)
      4. "Other" as default
    """
    if sport_id is not None and sport_id in SPORT_ID_MAP:
        return SPORT_ID_MAP[sport_id]

    if not sport_name:
        return "Other"

    # Identity: input is already an internal category (idempotent)
    if sport_name in INTERNAL_CATEGORIES:
        return sport_name

    text = sport_name.lower()
    for category, keywords in SPORT_STRING_RULES:
        for kw in keywords:
            if kw.lower() in text:
                return category
    return "Other"


def normalize_sport_lower(sport_name: str, sport_id: Optional[int] = None) -> str:
    """Same as normalize_sport but returns lowercase (e.g. "run", "bike").

    Used by processing-layer code that expects lowercase sport strings.
    """
    return normalize_sport(sport_name, sport_id).lower()
