import pytest
import pandas as pd
from datetime import datetime
from projectk_core.logic.interval_engine import PlanProjector
from projectk_core.logic.models import PlannedStructure, PlannedInterval

def test_plan_projector_simple_duration():
    """Test projecting a simple plan with duration-based intervals."""
    intervals = [
        PlannedInterval(type="warmup", duration=600, name="Warmup"),
        PlannedInterval(type="active", duration=60, name="Interval 1"),
        PlannedInterval(type="rest", duration=60, name="Rest 1")
    ]
    plan = PlannedStructure(source="test", intervals=intervals)
    
    projector = PlanProjector(plan)
    projected = projector.project()
    
    assert len(projected) == 3
    assert projected[0].start_time == 0
    assert projected[0].end_time == 600
    assert projected[1].start_time == 600
    assert projected[1].end_time == 660
    assert projected[2].start_time == 660
    assert projected[2].end_time == 720

def test_plan_projector_with_distance():
    """Test projecting a plan that includes distance (should estimate time if speed missing)."""
    # For now, let's assume we handle distance by skipping or using a default speed if no streams provided
    intervals = [
        PlannedInterval(type="active", distance_m=1000, name="1km effort")
    ]
    plan = PlannedStructure(source="test", intervals=intervals)
    projector = PlanProjector(plan)
    
    # If no streams provided, we might not be able to project distance-based precisely
    # But for now, let's ensure it doesn't crash and maybe uses a fallback or returns metadata
    projected = projector.project()
    assert len(projected) == 1
    # Without speed data, start/end might be None or 0
