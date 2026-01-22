
import pytest
import numpy as np
from projectk_core.logic.step_detector import StepDetector

def test_step_detector_basic():
    # Signal with a clear step
    # 100s at 100W, then 100s at 300W
    signal = np.concatenate([np.full(100, 100.0), np.full(100, 300.0)])
    
    detector = StepDetector(window_size=10, threshold_factor=1.0)
    steps = detector.detect_steps(signal)
    
    assert len(steps) >= 1
    # Step should be around index 100
    assert 90 <= steps[0] <= 110

def test_step_detector_no_steps():
    # Constant signal
    signal = np.full(200, 200.0)
    
    detector = StepDetector(window_size=10, threshold_factor=2.0)
    steps = detector.detect_steps(signal)
    
    assert len(steps) == 0

def test_step_detector_multiple_steps():
    # 3 sets
    signal = np.concatenate([
        np.full(50, 100.0), # Recovery
        np.full(50, 300.0), # Int 1
        np.full(50, 100.0), # Recovery
        np.full(50, 300.0)  # Int 2
    ])
    
    detector = StepDetector(window_size=10, threshold_factor=1.0)
    steps = detector.detect_steps(signal)
    
    # We expect 3 transitions: 100->300, 300->100, 100->300
    assert len(steps) >= 3

def test_segmentation():
    signal = np.concatenate([np.full(50, 100.0), np.full(50, 300.0)])
    detector = StepDetector(window_size=10)
    steps = [50]
    segments = detector.segment_by_steps(signal, steps)
    
    assert len(segments) == 2
    assert segments[0]['mean'] == 100.0
    assert segments[1]['mean'] == 300.0
