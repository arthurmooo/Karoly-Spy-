import pytest
import pandas as pd
import numpy as np
from projectk_core.logic.interval_engine import IntervalMetricsCalculator
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_metrics_decoupling():
    """Test Aerobic Decoupling calculation (First Half vs Second Half)."""
    # 120s Interval
    # First 60s: 200W, 140bpm
    # Last 60s: 200W, 150bpm
    
    times = np.arange(120)
    power = np.full(120, 200.0)
    hr = np.concatenate([np.full(60, 140.0), np.full(60, 150.0)])
    
    df = pd.DataFrame({
        "time": times,
        "power": power,
        "heart_rate": hr
    })
    
    block = IntervalBlock(start_time=0, end_time=120, type="active", detection_source=DetectionSource.ALGO)
    
    calculator = IntervalMetricsCalculator(df)
    enriched = calculator.calculate(block)
    
    assert enriched.decoupling is not None
    assert 0.05 < enriched.decoupling < 0.08 # Around 6-7%
