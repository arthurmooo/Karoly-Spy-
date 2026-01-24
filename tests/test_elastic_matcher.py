import pytest
from projectk_core.logic.interval_engine import ElasticMatcher
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_elastic_matcher_simple_shift():
    """Test shifting a plan to align with reality."""
    # Theoretical plan: 10min warmup, 1min effort
    projected = [
        IntervalBlock(start_time=0, end_time=600, type="warmup", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=600, end_time=660, type="active", detection_source=DetectionSource.PLAN)
    ]
    
    # In reality, the athlete started 5 seconds late
    # We want to shift the whole plan by 5 seconds
    matcher = ElasticMatcher(projected)
    matched = matcher.apply_shift(5.0)
    
    assert matched[0].start_time == 5.0
    assert matched[0].end_time == 605.0
    assert matched[1].start_time == 605.0
    assert matched[1].end_time == 665.0

def test_elastic_matcher_scaling():
    """Test scaling an interval to fit a detected duration."""
    projected = [
        IntervalBlock(start_time=0, end_time=60, type="active", detection_source=DetectionSource.PLAN)
    ]
    
    # Athlete did 65 seconds instead of 60
    matcher = ElasticMatcher(projected)
    # This is a bit more complex, maybe we scale the specific block
    matched = matcher.scale_block(0, 65.0)
    
    assert matched[0].duration == 65.0
    assert matched[0].start_time == 0.0
    assert matched[0].end_time == 65.0
