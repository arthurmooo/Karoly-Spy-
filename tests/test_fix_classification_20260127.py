
import unittest
import pandas as pd
import numpy as np
from projectk_core.logic.classifier import ActivityClassifier

class TestFixClassification(unittest.TestCase):
    
    def setUp(self):
        self.classifier = ActivityClassifier()

    def test_plan_endurance_single_block(self):
        """
        Strategy A: Plan with a single 'active' block should be classified as 'endurance'.
        This represents a planned 'Footing' or 'Endurance' session.
        """
        target_grid = [{"type": "active", "duration": 3600, "name": "Footing"}]
        # Currently this FAILS (returns 'intervals')
        res = self.classifier.detect_work_type(pd.DataFrame(), "Course à pied", "Training", target_grid=target_grid, sport_name="Run")
        self.assertEqual(res, "endurance")

    def test_plan_intervals_multiple_blocks(self):
        """
        Strategy A: Plan with multiple 'active' blocks should be classified as 'intervals'.
        """
        target_grid = [
            {"type": "active", "duration": 300, "name": "Série 1"},
            {"type": "active", "duration": 300, "name": "Série 2"}
        ]
        res = self.classifier.detect_work_type(pd.DataFrame(), "Séance Seuil", "Training", target_grid=target_grid, sport_name="Run")
        self.assertEqual(res, "intervals")

    def test_auto_lap_running_1km(self):
        """
        Strategy B: Running with many 1000m laps and low variance should be 'endurance'.
        """
        # Create a noisy signal (CV > 0.40)
        signal = [3.0, 1.0, 5.0, 0.5] * 25
        df = pd.DataFrame({'speed': signal})
        
        # 5 laps of exactly 1000m
        laps = [
            {"total_distance": 1000, "total_timer_time": 333, "avg_speed": 3.0},
            {"total_distance": 1000, "total_timer_time": 334, "avg_speed": 3.0},
            {"total_distance": 1000, "total_timer_time": 332, "avg_speed": 3.0},
            {"total_distance": 1000, "total_timer_time": 333, "avg_speed": 3.0},
            {"total_distance": 1000, "total_timer_time": 333, "avg_speed": 3.0}
        ]
        
        # Non-generic title
        res = self.classifier.detect_work_type(df, "Footing du soir", "Training", sport_name="Run", laps=laps)
        self.assertEqual(res, "endurance")

    def test_auto_lap_swimming_100m(self):
        """
        Strategy B: Swimming with 100m auto-laps and low variance should be 'endurance'.
        """
        # Signal CV must be > 0.40 to trigger intervals in current logic
        # 1.2 m/s with some noise
        signal = [1.2, 0.5, 1.8, 0.2] * 25
        df = pd.DataFrame({'speed': signal}) 
        
        laps = [
            {"total_distance": 100, "total_timer_time": 83, "avg_speed": 1.2},
            {"total_distance": 100, "total_timer_time": 84, "avg_speed": 1.2},
            {"total_distance": 100, "total_timer_time": 83, "avg_speed": 1.2},
            {"total_distance": 100, "total_timer_time": 83, "avg_speed": 1.2}
        ]
        # Non-generic title
        res = self.classifier.detect_work_type(df, "Natation le midi", "Training", sport_name="Swim", laps=laps)
        self.assertEqual(res, "endurance")

    def test_true_intervals_with_laps(self):
        """
        True intervals with variable lap distances or high variance should stay 'intervals'.
        """
        df = pd.DataFrame({'speed': np.concatenate([np.full(50, 2.0), np.full(50, 5.0)])})
        laps = [
            {"total_distance": 400, "total_timer_time": 80, "avg_speed": 5.0},
            {"total_distance": 200, "total_timer_time": 100, "avg_speed": 2.0},
            {"total_distance": 400, "total_timer_time": 80, "avg_speed": 5.0}
        ]
        res = self.classifier.detect_work_type(df, "Séance VMA", "Training", sport_name="Run", laps=laps)
        self.assertEqual(res, "intervals")

    def test_true_intervals_high_cv(self):
        """
        True intervals with high CV should stay as 'intervals'.
        """
        n = 100
        signal = np.concatenate([np.full(20, 2.0), np.full(20, 5.0)] * 2 + [np.full(20, 2.0)])
        df = pd.DataFrame({'speed': signal})
        
        res = self.classifier.detect_work_type(df, "Unknown", "Training", sport_name="Run")
        self.assertEqual(res, "intervals")

if __name__ == '__main__':
    unittest.main()
