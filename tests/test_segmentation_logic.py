import pytest
import pandas as pd
import numpy as np
from projectk_core.processing.segmentation import SegmentCalculator
from projectk_core.logic.models import SegmentData

def test_calculate_segment_metrics_run():
    # Setup dummy Run data
    df = pd.DataFrame({
        'heart_rate': [140, 150, 160],
        'speed': [10.0 / 3.6, 11.0 / 3.6, 12.0 / 3.6], # m/s
        'distance': [0, 500, 1000] # meters
    })
    
    calc = SegmentCalculator()
    data = calc.calculate_segment(df, "run")
    
    assert isinstance(data, SegmentData)
    assert data.hr == 150.0
    assert data.speed == 11.0
    # Ratio = Speed / HR = 11 / 150 = 0.0733...
    assert data.ratio == pytest.approx(0.073, abs=0.001)

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
    # Ratio = Power / HR = 210 / 145 = 1.448...
    assert pytest.approx(data.ratio, 0.01) == 1.45

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
    assert data.ratio == pytest.approx(1.67, 0.05)


def test_auto_split_skips_first_10min_for_q_phases():
    # 2000 points (~seconds). First 600s are warmup at low speed, then steady.
    df = pd.DataFrame({
        'heart_rate': [120.0] * 600 + [160.0] * 1400,
        'speed': [3.0] * 600 + [5.0] * 1400,
    })

    calc = SegmentCalculator()
    splits4 = calc.auto_split(df, 4, "run", skip_first_seconds=600)

    assert len(splits4) == 4
    # Q1 should be based on post-warmup data.
    assert splits4["phase_1"].hr == pytest.approx(160.0, 0.1)


def test_calculate_drift_uses_karoly_formula():
    calc = SegmentCalculator()
    splits = {
        "phase_1": SegmentData(ratio=1.50),
        "phase_2": SegmentData(ratio=1.35),
    }

    drift = calc.calculate_drift(splits)

    assert drift == pytest.approx(10.0, 0.01)
