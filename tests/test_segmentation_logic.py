import pytest
import pandas as pd
import numpy as np
from projectk_core.processing.segmentation import SegmentCalculator
from projectk_core.logic.models import SegmentData

def test_calculate_segment_metrics_run():
    # Setup dummy Run data
    df = pd.DataFrame({
        'heart_rate': [140, 150, 160],
        'speed': [10.0, 11.0, 12.0], # km/h
        'distance': [0, 500, 1000] # meters
    })
    
    calc = SegmentCalculator()
    data = calc.calculate_segment(df, "run")
    
    assert isinstance(data, SegmentData)
    assert data.hr == 150.0
    assert data.speed == 11.0
    # Ratio = HR / Speed = 150 / 11 = 13.636...
    assert pytest.approx(data.ratio, 0.1) == 13.6

def test_calculate_segment_metrics_bike():
    # Setup dummy Bike data
    df = pd.DataFrame({
        'heart_rate': [140, 150],
        'power': [200, 220],
        'torque': [10, 12]
    })
    
    calc = SegmentCalculator()
    data = calc.calculate_segment(df, "bike")
    
    assert data.power == 210.0
    assert data.torque == 11.0
    # Ratio = HR / Power = 145 / 210 = 0.69...
    assert pytest.approx(data.ratio, 0.01) == 0.69

def test_auto_split_logic():
    # 100 rows
    df = pd.DataFrame({
        'heart_rate': np.linspace(130, 170, 100),
        'speed': np.ones(100) * 10
    })
    
    calc = SegmentCalculator()
    
    # Test split 2
    splits = calc.auto_split(df, 2, "run")
    assert len(splits) == 2
    assert "phase_1" in splits
    assert "phase_2" in splits
    assert splits["phase_1"].hr < splits["phase_2"].hr
    
    # Test split 4
    splits4 = calc.auto_split(df, 4, "run")
    assert len(splits4) == 4
    assert "phase_1" in splits4
    assert "phase_4" in splits4


def test_home_trainer_power_filter_stabilizes_ratio():
    # 90 samples at realistic power + 30 samples of low-power noise.
    df = pd.DataFrame({
        'heart_rate': [150.0] * 120,
        'power': [250.0] * 90 + [20.0] * 30,
    })

    calc = SegmentCalculator()
    data = calc.calculate_segment(df, "Vélo - Home Trainer")

    # Low-power noise should be filtered out in HT mode.
    assert data.power == pytest.approx(250.0, 0.5)
    assert data.ratio == pytest.approx(0.6, 0.05)
