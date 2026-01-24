import pytest
import pandas as pd
import numpy as np
from projectk_core.logic.interval_engine import AlgoDetector
from projectk_core.logic.models import DetectionSource

def test_algo_detector_power_jumps():
    """Test detecting intervals based on power signal ruptures."""
    # Create a dummy stream: 10s at 100W, 10s at 300W, 10s at 100W
    times = np.arange(30)
    power = np.concatenate([
        np.full(10, 100.0),
        np.full(10, 300.0),
        np.full(10, 100.0)
    ])
    df = pd.DataFrame({"time": times, "power": power})
    
    detector = AlgoDetector(df)
    blocks = detector.detect()
    
    # We expect 3 blocks: recovery, active, recovery
    assert len(blocks) == 3
    assert blocks[1].start_time == 10.0
    assert blocks[1].end_time == 20.0
    assert blocks[1].detection_source == DetectionSource.ALGO

def test_algo_detector_no_signal():
    """Test detector behavior with flat signal."""
    times = np.arange(30)
    power = np.full(30, 150.0)
    df = pd.DataFrame({"time": times, "power": power})
    
    detector = AlgoDetector(df)
    blocks = detector.detect()
    
    # Should probably return 1 single block for the whole duration
    assert len(blocks) == 1
    assert blocks[0].duration == 29.0
