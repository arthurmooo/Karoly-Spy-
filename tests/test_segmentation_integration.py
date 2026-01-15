import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.processing.calculator import MetricsCalculator

@pytest.fixture
def athlete_config():
    # We mock or use an empty config since we don't need real DB connection for these unit tests
    # Note: AthleteConfig expects a DBConnector if not loaded.
    # We'll mock the get method.
    from unittest.mock import MagicMock
    config = MagicMock(spec=AthleteConfig)
    config.get.side_effect = lambda k, d: d # Return default
    return config

@pytest.fixture
def physio_profile():
    return PhysioProfile(
        valid_from=datetime(2026, 1, 1),
        lt1_hr=140,
        lt2_hr=160,
        cp=250
    )

def test_integration_segmentation_competition_run(athlete_config, physio_profile):
    # Setup a "Competition" Run
    meta = ActivityMetadata(activity_type="Run", start_time=datetime.now(), duration_sec=1000)
    df = pd.DataFrame({
        'heart_rate': np.linspace(140, 160, 1000),
        'speed': np.ones(1000) * 12, # 12 km/h
        'distance': np.linspace(0, 3333, 1000)
    })
    activity = Activity(meta, df)
    
    calc = MetricsCalculator(athlete_config)
    results = calc.compute(activity, physio_profile, nolio_type="Competition", nolio_comment="Marathon")
    
    seg = results["segmented_metrics"]
    assert seg.segmentation_type == "auto_competition"
    assert "phase_1" in seg.splits_2
    assert "phase_4" in seg.splits_4
    assert seg.splits_2["phase_1"].speed == 12.0
    assert seg.splits_2["phase_1"].torque is None

def test_integration_segmentation_bike_torque(athlete_config, physio_profile):
    # Setup a Bike activity with Power and Torque
    meta = ActivityMetadata(activity_type="Ride", start_time=datetime.now(), duration_sec=1000)
    df = pd.DataFrame({
        'heart_rate': np.ones(1000) * 140,
        'power': np.ones(1000) * 200,
        'torque': np.ones(1000) * 15,
        'distance': np.linspace(0, 10000, 1000)
    })
    activity = Activity(meta, df)
    
    calc = MetricsCalculator(athlete_config)
    results = calc.compute(activity, physio_profile) # Default auto_training
    
    seg = results["segmented_metrics"]
    assert seg.segmentation_type == "auto_training"
    assert seg.splits_2["phase_1"].power == 200.0
    assert seg.splits_2["phase_1"].torque == 15.0
    # Ratio = 140 / 200 = 0.7
    assert seg.splits_2["phase_1"].ratio == 0.7

def test_integration_manual_split(athlete_config, physio_profile):
    # Setup activity with manual #split tag
    meta = ActivityMetadata(activity_type="Run", start_time=datetime.now(), duration_sec=3600)
    df = pd.DataFrame({
        'heart_rate': np.ones(3600) * 150,
        'speed': np.ones(3600) * 10,
        'distance': np.linspace(0, 10000, 3600) # 10km total
    })
    activity = Activity(meta, df)
    
    calc = MetricsCalculator(athlete_config)
    # Manual split 0-5km and 5-10km
    comment = "Analyse specifique #split: 0-5, 5-10"
    results = calc.compute(activity, physio_profile, nolio_comment=comment)
    
    seg = results["segmented_metrics"]
    assert seg.segmentation_type == "manual"
    assert len(seg.manual) == 2
    # Check that it sliced correctly
    # If speed is 10km/h, 5km is exactly 1800s.
    # Our manual_split logic uses df[(df['distance'] >= 0) & (df['distance'] <= 5000)]
    # So it should find the data.
    assert seg.manual["phase_1"].hr == 150.0
