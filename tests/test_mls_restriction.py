import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.processing.calculator import MetricsCalculator

# Mock config for the test
class MockConfig:
    def get(self, key, default=0.0):
        defaults = {
            'alpha_load_hr': 0.5,
            'beta_load_power': 1.0,
            'drift_threshold_percent': 3.0,
            'beta_dur': 0.08
        }
        return defaults.get(key, default)

@pytest.fixture
def basic_physio_profile():
    return PhysioProfile(
        lt1_hr=140, lt2_hr=160,
        cp=300, valid_from=datetime(2024, 1, 1)
    )

def create_activity(activity_type):
    seconds = 600
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='S'),
        'power': [200.0] * seconds,
        'heart_rate': [150.0] * seconds,
        'speed': [3.0] * seconds,
        'cadence': [90] * seconds
    })
    
    meta = ActivityMetadata(
        activity_type=activity_type,
        start_time=datetime(2024, 1, 1),
        duration_sec=seconds
    )
    return Activity(metadata=meta, streams=df)

def test_mls_calculated_for_run(basic_physio_profile):
    activity = create_activity("Running")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is not None

def test_mls_calculated_for_bike(basic_physio_profile):
    activity = create_activity("Cycling")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is not None

def test_mls_none_for_swim(basic_physio_profile):
    activity = create_activity("Swimming")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is None

def test_mls_none_for_strength(basic_physio_profile):
    activity = create_activity("Strength Training")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is None

def test_mls_none_for_other(basic_physio_profile):
    activity = create_activity("Yoga")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is None

def test_mls_none_for_hiking(basic_physio_profile):
    activity = create_activity("Hiking")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is None

def test_mls_none_for_ski(basic_physio_profile):
    activity = create_activity("Ski")
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    assert result['mls_load'] is None
