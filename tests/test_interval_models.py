from projectk_core.logic.models import IntervalBlock, DetectionSource
import pytest
from enum import Enum

def test_detection_source_enum():
    """Verify DetectionSource enum values."""
    assert DetectionSource.PLAN.value == "plan"
    assert DetectionSource.LAP.value == "lap"
    assert DetectionSource.ALGO.value == "algo"

def test_interval_block_creation():
    """Verify IntervalBlock creation and basic properties."""
    block = IntervalBlock(
        start_time=100.0,
        end_time=200.0,
        type="active",
        detection_source=DetectionSource.PLAN
    )
    assert block.start_time == 100.0
    assert block.end_time == 200.0
    assert block.type == "active"
    assert block.detection_source == DetectionSource.PLAN
    assert block.duration == 100.0

def test_interval_block_validation():
    """Verify IntervalBlock validation."""
    with pytest.raises(ValueError):
        # End time before start time
        IntervalBlock(
            start_time=200.0,
            end_time=100.0,
            type="active",
            detection_source=DetectionSource.ALGO
        )
