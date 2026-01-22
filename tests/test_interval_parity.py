
import pytest
from projectk_core.processing.lap_calculator import LapCalculator

class TestLapCalculatorParity:
    """
    Tests to ensure lap calculations match Nolio's logic,
    specifically regarding Moving Time vs Elapsed Time.
    """

    def test_clean_lap(self):
        """Standard lap with no pauses should stay consistent."""
        lap = {
            'total_elapsed_time': 300.0,
            'total_timer_time': 300.0,
            'total_distance': 1000.0,
            'avg_speed': 3.33
        }
        
        metrics = LapCalculator.recalculate(lap)
        
        assert metrics['calculated_speed'] == pytest.approx(3.33, 0.01)
        assert metrics['effective_duration'] == 300.0

    def test_lap_with_pause(self):
        """
        Lap with significant pause (Elapsed > Timer).
        Speed should be based on Timer Time (Moving Speed).
        """
        lap = {
            'total_elapsed_time': 500.0, # 200s pause
            'total_timer_time': 300.0,
            'total_distance': 1000.0,
            'avg_speed': 2.0 # Device might report 1000/500
        }
        
        metrics = LapCalculator.recalculate(lap)
        
        # We expect speed to be ~3.33 (1000/300)
        assert metrics['calculated_speed'] == pytest.approx(3.33, 0.01)
        # We expect the duration used for load/intensity to be 300
        assert metrics['effective_duration'] == 300.0

    def test_missing_timer_time(self):
        """Fallback to elapsed if timer time is missing."""
        lap = {
            'total_elapsed_time': 500.0,
            'total_timer_time': None,
            'total_distance': 1000.0,
            'avg_speed': 2.0
        }
        
        metrics = LapCalculator.recalculate(lap)
        
        assert metrics['calculated_speed'] == pytest.approx(2.0, 0.01)
        assert metrics['effective_duration'] == 500.0

    def test_zero_division_protection(self):
        """Should handle zero duration gracefully."""
        lap = {
            'total_elapsed_time': 0.0,
            'total_timer_time': 0.0,
            'total_distance': 0.0,
            'avg_speed': 0.0
        }
        
        metrics = LapCalculator.recalculate(lap)
        
        assert metrics['calculated_speed'] == 0.0
        assert metrics['effective_duration'] == 0.0
