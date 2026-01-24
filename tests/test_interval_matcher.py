
import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from projectk_core.processing.interval_matcher import IntervalMatcher

class TestIntervalMatcher(unittest.TestCase):
    
    def setUp(self):
        self.matcher = IntervalMatcher()

    def test_strict_window_matching_power(self):
        """
        Test matching 3x1min @ 300W on a synthetic signal.
        The signal will have 3 peaks of 300W for 60s, separated by rest.
        We expect the matcher to find these exact windows.
        """
        # 1. Create Synthetic Data (1Hz)
        # 5min warmup (100W), 1min Work (300W), 1min Rest (100W)...
        # Total: 5min + (1min+1min)*3 = 11 mins = 660s
        timestamps = pd.date_range(start='2026-01-01 10:00:00', periods=660, freq='1s')
        power = np.full(660, 100) # Baseline 100W
        
        # Inject Work Intervals
        # Interval 1: 300-360s (Index)
        power[300:360] = 300
        # Interval 2: 420-480s
        power[420:480] = 300
        # Interval 3: 540-600s
        power[540:600] = 300
        
        df = pd.DataFrame({'timestamp': timestamps, 'power': power, 'speed': np.zeros(660)})
        
        target_grid = [
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300},
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300},
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300}
        ]
        
        # 3. Match
        results = self.matcher.match(df, target_grid, sport="bike")
        
        # 4. Assertions
        self.assertEqual(len(results), 3)
        
        # Check alignment (Allowing small tolerance if we implement heuristic search)
        # But Strict Window should be nearly exact if signal is perfect
        self.assertAlmostEqual(results[0]['avg_power'], 300, delta=1)
        self.assertAlmostEqual(results[1]['avg_power'], 300, delta=1)
        self.assertAlmostEqual(results[2]['avg_power'], 300, delta=1)
        
        # Check durations
        self.assertEqual(results[0]['duration_sec'], 60)

    def test_missing_interval(self):
        """
        Test matching 3 intervals when only 2 were performed.
        """
        # Create data with only 2 peaks
        timestamps = pd.date_range(start='2026-01-01 10:00:00', periods=600, freq='1s')
        power = np.full(600, 100)
        power[300:360] = 300 # Int 1
        power[420:480] = 300 # Int 2
        # Missing Int 3
        
        df = pd.DataFrame({'timestamp': timestamps, 'power': power})
        
        target_grid = [
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300},
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300},
            {"duration": 60, "target_type": "power", "type": "active", "target_min": 300}
        ]
        
        results = self.matcher.match(df, target_grid, sport="bike")
        
        # We expect it to find the 2 best ones.
        # Should we return 2 or 3 (with one empty)?
        # Spec said: "Reality-Centric: Detect the actual number... report 8 if 8 found."
        self.assertEqual(len(results), 2)
        self.assertAlmostEqual(results[0]['avg_power'], 300, delta=1)

    def test_respect_score(self):
        """
        Test that respect score is calculated correctly.
        Target 300W, Realized 270W -> 90%
        """
        timestamps = pd.date_range(start='2026-01-01 10:00:00', periods=120, freq='1s')
        power = np.full(120, 270)
        df = pd.DataFrame({'timestamp': timestamps, 'power': power})
        
        target_grid = [{"duration": 60, "target_type": "power", "type": "active", "target_min": 300}]
        
        results = self.matcher.match(df, target_grid, sport="bike")
        
        self.assertEqual(len(results), 1)
        self.assertAlmostEqual(results[0]['respect_score'], 90.0, delta=1)

    def test_bernard_alexis_case(self):
        """
        Test separation of Effort (1'30) from Active Recovery (3'30).
        Total block is 5' of higher power, but the plan only asks for 1'30.
        """
        # 600s warmup 150W
        # 90s Effort 400W
        # 210s Active Recovery 250W
        # 300s cool down 150W
        # Total: 1200s
        timestamps = pd.date_range(start='2026-01-01 10:00:00', periods=1200, freq='1s')
        power = np.full(1200, 150.0)
        power[600:690] = 400.0
        power[690:900] = 250.0 # Active Recovery
        
        df = pd.DataFrame({'timestamp': timestamps, 'power': power})
        
        # Plan asks for 1'30 @ 400W
        target_grid = [{"duration": 90, "target_type": "power", "type": "active", "target_min": 400}]
        
        results = self.matcher.match(df, target_grid, sport="bike")
        
        self.assertEqual(len(results), 1)
        # Should match the 90s effort EXACTLY
        self.assertEqual(results[0]['duration_sec'], 90)
        self.assertEqual(results[0]['start_index'], 600)
        self.assertEqual(results[0]['end_index'], 690)
        self.assertAlmostEqual(results[0]['avg_power'], 400, delta=1)

if __name__ == '__main__':
    unittest.main()
