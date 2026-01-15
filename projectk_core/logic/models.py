from typing import List, Optional, Dict
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

class SegmentData(BaseModel):
    """
    Metrics for a specific segment/phase of an activity.
    """
    hr: Optional[float] = None
    speed: Optional[float] = None
    power: Optional[float] = None
    ratio: Optional[float] = Field(None, description="Efficiency Factor (HR/Speed or HR/Power)")
    torque: Optional[float] = None

class SegmentationOutput(BaseModel):
    """
    Container for multi-phase segmentation results.
    """
    segmentation_type: str = Field(..., description="e.g. 'auto_competition', 'auto_training', 'manual'")
    splits_2: Optional[Dict[str, SegmentData]] = None
    splits_4: Optional[Dict[str, SegmentData]] = None
    manual: Optional[Dict[str, SegmentData]] = None

class ActivityMetrics(BaseModel):
    """
    Computed physiological metrics for an activity.
    """
    # Standard Metrics
    normalized_power: Optional[float] = None
    tss: Optional[float] = None
    intensity_factor: Optional[float] = None
    energy_kj: Optional[float] = None
    
    # Karoly Specific
    mls_load: Optional[float] = None
    mec: Optional[float] = None
    int_index: Optional[float] = None
    dur_index: Optional[float] = None
    drift_pahr_percent: Optional[float] = None
    
    # Interval Metrics
    interval_power_last: Optional[float] = None
    interval_hr_last: Optional[float] = None
    interval_power_mean: Optional[float] = None
    interval_hr_mean: Optional[float] = None
    
    # Smart Segmentation Metrics
    segmented_metrics: Optional[SegmentationOutput] = None

class Activity:
    """
    Represents a single workout session with raw data streams and computed metrics.
    """
    def __init__(self, metadata: ActivityMetadata, streams: pd.DataFrame, laps: Optional[List[dict]] = None):
        self.metadata = metadata
        self.streams = streams
        self.laps = laps or []
        self.metrics: ActivityMetrics = ActivityMetrics()
    
    @property
    def empty(self) -> bool:
        return self.streams.empty
