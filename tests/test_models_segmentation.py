import pytest
from projectk_core.logic.models import ActivityMetrics, SegmentationOutput, SegmentData
from pydantic import ValidationError

def test_segment_data_model():
    """Test the SegmentData model validation."""
    # Valid data
    data = SegmentData(hr=150.0, speed=12.5, ratio=12.0)
    assert data.hr == 150.0
    assert data.speed == 12.5
    assert data.power is None # Optional
    
    # Valid data with power/torque
    data_bike = SegmentData(hr=140, power=200, ratio=0.7, torque=15.5)
    assert data_bike.power == 200
    assert data_bike.torque == 15.5
    assert data_bike.speed is None

def test_segmentation_output_model():
    """Test the SegmentationOutput model structure."""
    
    # Create sample segment data
    seg1 = SegmentData(hr=140, speed=10, ratio=14)
    seg2 = SegmentData(hr=150, speed=10, ratio=15)
    
    # Test splits_2 structure (dictionary of phases)
    output = SegmentationOutput(
        segmentation_type="auto_competition",
        splits_2={
            "phase_1": seg1,
            "phase_2": seg2
        }
    )
    
    assert output.segmentation_type == "auto_competition"
    assert output.splits_2["phase_1"].hr == 140
    assert output.splits_4 is None
    assert output.manual is None

def test_activity_metrics_integration():
    """Test that ActivityMetrics now includes the segmented_metrics field."""
    
    seg_out = SegmentationOutput(
        segmentation_type="manual",
        manual={
            "warmup": SegmentData(hr=120, speed=8, ratio=15),
            "main": SegmentData(hr=160, speed=14, ratio=11.4)
        }
    )
    
    metrics = ActivityMetrics(
        normalized_power=250,
        segmented_metrics=seg_out
    )
    
    assert metrics.normalized_power == 250
    assert metrics.segmented_metrics is not None
    assert metrics.segmented_metrics.segmentation_type == "manual"
    assert metrics.segmented_metrics.manual["main"].speed == 14
