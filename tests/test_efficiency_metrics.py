import pytest
import pandas as pd
import numpy as np
from projectk_core.logic.interval_engine import IntervalMetricsCalculator
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_metrics_efficiency_ratio():
    """Test Pa:Hr ratio calculation (Power / HR)."""
    # 200W / 100bpm = 2.0
    df = pd.DataFrame({
        "time": np.arange(60),
        "power": np.full(60, 200.0),
        "heart_rate": np.full(60, 100.0)
    })
    
    block = IntervalBlock(start_time=0, end_time=60, type="active", detection_source=DetectionSource.ALGO)
    
    calculator = IntervalMetricsCalculator(df)
    enriched = calculator.calculate(block)
    
    assert enriched.pa_hr_ratio == 2.0
