
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

    def test_generic_title_forces_endurance(self):
        """Should classify as 'endurance' if title matches sport name (and no plan)."""
        res = self.classifier.detect_work_type(pd.DataFrame(), "Ski de randonnée", "Training", sport_name="Ski de randonnée")
        self.assertEqual(res, "endurance")
        
        # Even with some variability, generic title should win if it's below the new high threshold
        n = 100
        signal = np.concatenate([np.full(50, 100), np.full(50, 150)]) # CV ~ 20%
        df = pd.DataFrame({'speed': signal})
        res = self.classifier.detect_work_type(df, "Vélo - Route", "Training", sport_name="Vélo - Route")
        self.assertEqual(res, "endurance")

    def test_endurance_keywords_force_endurance(self):
        """Should classify as 'endurance' if endurance keywords are present, even with high CV."""
        n = 100
        signal = np.concatenate([np.full(20, 100), np.full(20, 400)] * 2 + [np.full(20, 100)])
        df = pd.DataFrame({'power': signal})
        
        res = self.classifier.detect_work_type(df, "échauffement", "Training")
        self.assertEqual(res, "endurance")
        
        res = self.classifier.detect_work_type(df, "récupération active", "Training")
        self.assertEqual(res, "endurance")

    def test_new_interval_patterns(self):
        """Should detect new patterns like 6-4-r-2, Tempo, 1'-1'."""
        self.assertEqual(self.classifier.detect_work_type(None, "Workout: 6-4-r-2--", "Training"), "intervals")
        self.assertEqual(self.classifier.detect_work_type(None, "Vélocité 1'-1'", "Training"), "intervals")
        self.assertEqual(self.classifier.detect_work_type(None, "2Km Tempo", "Training"), "intervals")
        self.assertEqual(self.classifier.detect_work_type(None, "Bloc Z3", "Training"), "intervals")

    def test_competition_patterns(self):
        """Should detect competition keywords like Corrida, Cross, etc."""
        self.assertEqual(self.classifier.detect_work_type(None, "Corrida de Saint-Jo'", "Training"), "competition")
        self.assertEqual(self.classifier.detect_work_type(None, "Cross Ouest France", "Training"), "competition")



if __name__ == '__main__':
    unittest.main()
