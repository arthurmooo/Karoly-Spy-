import pytest
from projectk_core.logic.interval_engine import EnsembleVoter
from projectk_core.logic.models import IntervalBlock, DetectionSource

def test_ensemble_voter_fusion():
    """Test fusing Plan, Laps, and Algo data."""
    plan_blocks = [
        IntervalBlock(start_time=0, end_time=600, type="warmup", detection_source=DetectionSource.PLAN),
        IntervalBlock(start_time=600, end_time=660, type="active", detection_source=DetectionSource.PLAN)
    ]
    
    # User pressed lap 5 seconds late
    lap_blocks = [
        IntervalBlock(start_time=0, end_time=605, type="warmup", detection_source=DetectionSource.LAP),
        IntervalBlock(start_time=605, end_time=665, type="active", detection_source=DetectionSource.LAP)
    ]
    
    # Algo detected rupture at 602
    algo_blocks = [
        IntervalBlock(start_time=0, end_time=602, type="rest", detection_source=DetectionSource.ALGO),
        IntervalBlock(start_time=602, end_time=662, type="active", detection_source=DetectionSource.ALGO)
    ]
    
    voter = EnsembleVoter(plan_blocks, lap_blocks, algo_blocks)
    fused = voter.fuse()
    
    # For now, let's say it prioritizes Laps for start/end if available, 
    # but we'll refine the logic.
    assert len(fused) > 0
    # If Priority 2 is Laps, we expect something close to 605
    assert 600 <= fused[1].start_time <= 605

def test_ensemble_voter_no_laps():
    """Test fusion when laps are missing (fallback to Plan + Algo)."""
    plan_blocks = [
        IntervalBlock(start_time=600, end_time=660, type="active", detection_source=DetectionSource.PLAN)
    ]
    algo_blocks = [
        IntervalBlock(start_time=602, end_time=662, type="active", detection_source=DetectionSource.ALGO)
    ]
    
    voter = EnsembleVoter(plan_blocks, [], algo_blocks)
    fused = voter.fuse()
    
    assert len(fused) == 1
    # If shifted by 2s to align with first algo block
    assert fused[0].start_time == 602.0
