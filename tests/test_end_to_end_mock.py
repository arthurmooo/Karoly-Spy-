
import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
import numpy as np
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from datetime import datetime

class TestEndToEndMock(unittest.TestCase):
    
    def test_full_chain_intervals(self):
        """
        Simulate the full chain: Plan -> Parse -> Match -> Calculate Metrics.
        """
        # 1. Mock Nolio Plan (10x2' @ 300W/5.2m/s)
        plan_json = {
            "type": "repetition",
            "value": 10,
            "steps": [
                {"intensity_type": "active", "step_duration_value": 120, "target_value_min": 5.14, "target_type": "pace"},
                {"intensity_type": "rest", "step_duration_value": 60}
            ]
        }
        
        # 2. Parse Plan
        parser = NolioPlanParser()
        target_grid = parser.parse(plan_json)
        self.assertEqual(len(target_grid), 10)
        
        # 3. Create Dummy Data (Matching the plan perfectly)
        # 10 reps of (120s @ 5.2m/s + 60s @ 2.0m/s)
        speed_signal = []
        for _ in range(10):
            speed_signal.extend([5.2] * 120) # Active
            speed_signal.extend([2.0] * 60)  # Rest
            
        df = pd.DataFrame({
            'speed': speed_signal,
            'power': [0] * len(speed_signal), # Run
            'heart_rate': [150] * len(speed_signal),
            'timestamp': pd.date_range(start='2026-01-01', periods=len(speed_signal), freq='1s')
        })
        
        # 4. Activity & Profile
        meta = ActivityMetadata(
            activity_type="Run",
            start_time=datetime(2026, 1, 1),
            duration_sec=len(df),
            work_type="intervals" # Usually detected by classifier, but we force context here or test classifier too
        )
        activity = Activity(metadata=meta, streams=df)
        
        profile = PhysioProfile(
            valid_from=datetime(2026, 1, 1),
            lt1_hr=130, lt2_hr=160, cp_cs=5.0
        )
        
        # 5. Run Calculator (which calls Matcher)
        config = AthleteConfig()
        calculator = MetricsCalculator(config)
        
        # We simulate that the Classifier found "intervals" based on the plan
        metrics = calculator.compute(
            activity, 
            profile, 
            nolio_type="Training",
            target_grid=target_grid # Pass the parsed plan!
        )
        
        # 6. Verify Results
        print("\n--- End-to-End Mock Results ---")
        print(f"Work Type: {activity.metadata.work_type}")
        print(f"Interval Respect Score: {metrics.get('interval_respect_score')}")
        print(f"Interval Pace Mean: {metrics.get('interval_pace_mean')} min/km")
        
        # Respect score should be ~100% (5.2 realized / 5.14 target > 100)
        # Wait, my formula is realized / target_min * 100
        # 5.2 / 5.14 = 1.01 -> 101%
        
        self.assertIsNotNone(metrics.get('interval_respect_score'))
        self.assertTrue(metrics.get('interval_respect_score') > 99)
        self.assertIsNotNone(metrics.get('interval_pace_mean'))

if __name__ == '__main__':
    unittest.main()
