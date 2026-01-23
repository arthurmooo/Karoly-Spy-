
import unittest
import pandas as pd
import numpy as np
from projectk_core.logic.classifier import ActivityClassifier

class TestWorkoutClassifier(unittest.TestCase):
    
    def setUp(self):
        self.classifier = ActivityClassifier()

    def test_classify_by_plan_success(self):
        """Should classify as 'intervals' if a valid target grid is provided."""
        target_grid = [{"type": "active", "duration": 30}]
        # We'll need to update ActivityClassifier to accept target_grid or similar
        res = self.classifier.detect_work_type(pd.DataFrame(), "Normal Title", "Training", target_grid=target_grid)
        self.assertEqual(res, "intervals")

    def test_classify_by_signal_variability(self):
        """Should classify as 'intervals' if signal variability is high (even without plan)."""
        # Create a "jagged" signal (intervals)
        n = 100
        signal = np.concatenate([np.full(20, 100), np.full(20, 400)] * 2 + [np.full(20, 100)])
        df = pd.DataFrame({'power': signal})
        
        res = self.classifier.detect_work_type(df, "Unknown Session", "Training")
        self.assertEqual(res, "intervals")

    def test_classify_by_title_keyword(self):
        """Should classify as 'intervals' if title contains keywords like '10x30'."""
        res = self.classifier.detect_work_type(pd.DataFrame(), "10x30/30 Seuil", "Training")
        self.assertEqual(res, "intervals")
        
        # Test observed failing cases
        res = self.classifier.detect_work_type(pd.DataFrame(), "5*(40'' Z3 + 1'20'' Z2)", "Entraînement")
        self.assertEqual(res, "intervals", "Should detect 5*( as intervals")

        res = self.classifier.detect_work_type(pd.DataFrame(), "4Km : 2Km Tempo + 500m Z2", "Entraînement")
        self.assertEqual(res, "intervals", "Should detect 'Tempo' as intervals")

    def test_classify_endurance_baseline(self):
        """Should classify as 'endurance' for steady signal."""
        n = 100
        signal = np.full(n, 200) + np.random.normal(0, 5, n) # Flat with noise
        df = pd.DataFrame({'power': signal})
        
        res = self.classifier.detect_work_type(df, "Long Ride", "Training")
        self.assertEqual(res, "endurance")

if __name__ == '__main__':
    unittest.main()
