from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ValidationInfo
import pandas as pd

class PhysioProfile(BaseModel):
    """
    Represents an athlete's physiological thresholds at a specific point in time.
    """
    valid_from: datetime
    lt1_hr: float = Field(gt=0, description="Heart Rate at Lactate Threshold 1")
    lt2_hr: float = Field(gt=0, description="Heart Rate at Lactate Threshold 2")
    lt1_power: Optional[float] = Field(None, gt=0, description="Power at LT1")
    lt2_power: Optional[float] = Field(None, gt=0, description="Power at LT2")
    cp: Optional[float] = Field(None, gt=0, description="Critical Power")

    @field_validator('lt2_hr')
    @classmethod
    def lt2_greater_than_lt1(cls, v: float, info: ValidationInfo) -> float:
        values = info.data
        if 'lt1_hr' in values and v <= values['lt1_hr']:
            raise ValueError('LT2 HR must be greater than LT1 HR')
        return v

class Athlete:
    """
    Logic class representing an athlete and their history.
    """
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self.profiles: List[PhysioProfile] = []

    def add_profile(self, profile: PhysioProfile):
        self.profiles.append(profile)
        # Sort by date ascending
        self.profiles.sort(key=lambda x: x.valid_from)

    def get_profile_for_date(self, date: datetime) -> Optional[PhysioProfile]:
        """
        Returns the active profile for a given date.
        """
        # Iterate backwards to find the most recent profile valid at that date
        for profile in reversed(self.profiles):
            if profile.valid_from <= date:
                return profile
        return None

class ActivityMetadata(BaseModel):
    """
    Basic metadata for an activity.
    """
    activity_type: str
    start_time: datetime
    duration_sec: float = Field(gt=0)
    distance_m: Optional[float] = Field(None, ge=0)
    device_id: Optional[str] = None
    rpe: Optional[float] = Field(None, ge=1, le=10)

class Activity:
    """
    Represents a single workout session with raw data streams and computed metrics.
    """
    def __init__(self, metadata: ActivityMetadata, streams: pd.DataFrame):
        self.metadata = metadata
        self.streams = streams
        # Placeholder for computed metrics (will be populated by processing logic)
        self.metrics = {} 
    
    @property
    def empty(self) -> bool:
        return self.streams.empty
