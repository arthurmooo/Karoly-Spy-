import pytest
from projectk_core.logic.interval_engine import ElasticMatcher
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_handle_missing_repetitions():
    """Test removing skipped blocks from the plan."""
    # Theoretical plan: 3x1min with 1min rest
    projected = [
        IntervalBlock(start_time=0, end_time=60, type="active", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=60, end_time=120, type="rest", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=120, end_time=180, type="active", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=180, end_time=240, type="rest", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=240, end_time=300, type="active", detection_source=DetectionSource.PLAN)
    ]
    
    matcher = ElasticMatcher(projected)
    # Athlete skipped the last rep (index 4)
    # We want to be able to remove it
    matched = matcher.remove_blocks([4])
    
    assert len(matched) == 4
    assert matched[-1].type == "rest"
    assert matched[-1].end_time == 240
