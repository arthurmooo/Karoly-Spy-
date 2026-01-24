import pytest
from projectk_core.logic.interval_engine import LapAnalyzer
from projectk_core.logic.models import DetectionSource

def test_lap_analyzer_basic():
    """Test converting raw laps to IntervalBlocks."""
    raw_laps = [
        {"start_time": 0, "total_elapsed_time": 600, "intensity": "warmup"},
        {"start_time": 600, "total_elapsed_time": 60, "intensity": "active"},
        {"start_time": 660, "total_elapsed_time": 60, "intensity": "rest"}
    ]
    
    analyzer = LapAnalyzer(raw_laps)
    blocks = analyzer.to_blocks()
    
    assert len(blocks) == 3
    assert blocks[0].start_time == 0
    assert blocks[0].end_time == 600
    assert blocks[1].start_time == 600
    assert blocks[1].end_time == 660
    assert blocks[1].detection_source == DetectionSource.LAP

def test_lap_analyzer_filtering():
    """Test filtering out parasite laps (too short)."""
    raw_laps = [
        {"start_time": 0, "total_elapsed_time": 600, "intensity": "warmup"},
        {"start_time": 600, "total_elapsed_time": 2, "intensity": "active"}, # Parasite
        {"start_time": 602, "total_elapsed_time": 60, "intensity": "active"}
    ]
    
    analyzer = LapAnalyzer(raw_laps, min_duration=10.0)
    blocks = analyzer.to_blocks()
    
    # The 2s lap should be removed/merged or skipped. 
    # For now, let's say we skip it and adjust next block start if necessary, 
    # or just expect it to be gone from results.
    assert len(blocks) == 2
    assert blocks[0].duration == 600
    assert blocks[1].start_time == 602
    assert blocks[1].duration == 60
