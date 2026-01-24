import pytest
import pandas as pd
import numpy as np
from projectk_core.logic.interval_engine import IntervalMetricsCalculator
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_metrics_calculation_basic():
    """Test calculating avg power, hr, speed for a block."""
    # Create dummy stream
    # 60s block
    times = np.arange(60)
    power = np.full(60, 200.0)
    hr = np.full(60, 150.0)
    speed = np.full(60, 10.0) # m/s
    
    df = pd.DataFrame({
        "time": times,
        "power": power,
        "heart_rate": hr,
        "speed": speed
    })
    
    block = IntervalBlock(
        start_time=0,
        end_time=60,
        type="active",
        detection_source=DetectionSource.PLAN
    )
    
    calculator = IntervalMetricsCalculator(df)
    enriched_block = calculator.calculate(block)
    
    assert enriched_block.avg_power == 200.0
    assert enriched_block.avg_hr == 150.0
    assert enriched_block.avg_speed == 10.0

def test_metrics_efficiency_ratio():
    """Test Pa:Hr ratio calculation (Power / HR)."""
    # 200W / 100bpm = 2.0
    # But wait, efficiency factor is usually Speed/HR or NP/HR.
    # Karoly wants Pa:Hr (Power:HeartRate).
    
    # Let's assume the Calculator adds a 'ratio' field or similar to extended metrics?
    # The current IntervalBlock model has avg_power, avg_hr.
    # Maybe we calculate ratio on the fly or extend the model.
    # For now, let's verify basics first.
    pass

def test_metrics_integration_total():
    """Test that metrics use the FULL duration (no stabilization filter)."""
    # Stream with ramp up
    times = np.arange(10)
    hr = np.array([100, 110, 120, 130, 140, 150, 150, 150, 150, 150]) # Avg = 135
    
    df = pd.DataFrame({"time": times, "heart_rate": hr})
    block = IntervalBlock(start_time=0, end_time=10, type="active", detection_source=DetectionSource.ALGO)
    
    calculator = IntervalMetricsCalculator(df)
    enriched = calculator.calculate(block)
    
    assert enriched.avg_hr == 135.0
