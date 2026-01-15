import unittest
import pandas as pd
import numpy as np
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.interval_detector import IntervalDetector

class TestIntervalDetector(unittest.TestCase):
    
    def setUp(self):
        # Create a synthetic activity
        # 10 minutes (600s) total
        # Interval 1: 100-200s @ 300W
        # Interval 2: 300-400s @ 320W
        # Rest: 150W
        
        timestamps = pd.date_range(start='2024-01-01', periods=600, freq='1s')
        power = np.full(600, 150.0)
        hr = np.full(600, 140.0)
        
        # Interval 1 (100s duration)
        power[100:200] = 300.0
        hr[100:200] = 170.0
        
        # Interval 2 (100s duration)
        power[300:400] = 320.0
        hr[300:400] = 180.0
        
        data = {
            'timestamp': timestamps,
            'power': power,
            'heart_rate': hr
        }
        self.df = pd.DataFrame(data)
        
        meta = ActivityMetadata(
            activity_type="Bike",
            start_time=timestamps[0],
            duration_sec=600,
            device_id="TestGen"
        )
        self.activity = Activity(metadata=meta, streams=self.df)

    def test_detect_simple_intervals(self):
        # Plan: 2 x 100s
        plan = {"type": "time", "duration": 100, "reps": 2}
        
        result = IntervalDetector.detect(self.activity, plan)
        
        self.assertIn("interval_power_mean", result)
        # Expected mean power: (300 + 320) / 2 = 310
        self.assertAlmostEqual(result['interval_power_mean'], 310.0, delta=1.0)
        
        # Expected last power: 320
        self.assertAlmostEqual(result['interval_power_last'], 320.0, delta=1.0)
        
        # Expected mean HR: (170 + 180) / 2 = 175
        self.assertAlmostEqual(result['interval_hr_mean'], 175.0, delta=1.0)

    def test_detect_single_best(self):
        # Plan: 1 x 100s (should pick the 320W one)
        plan = {"type": "time", "duration": 100, "reps": 1}
        
        result = IntervalDetector.detect(self.activity, plan)
        
        self.assertAlmostEqual(result['interval_power_mean'], 320.0, delta=1.0)
        self.assertAlmostEqual(result['interval_power_last'], 320.0, delta=1.0)

    def test_detect_no_match(self):
        # Plan: 1 x 500s (impossible, max duration is 600 total, but strict interval logic?)
        # If we ask for 500s, the rolling average will just be the mean of 500s blocks.
        # It should return something unless duration > total.
        
        plan = {"type": "time", "duration": 700, "reps": 1}
        result = IntervalDetector.detect(self.activity, plan)
        self.assertEqual(result, {})

    def test_detect_overlap_logic(self):
        # If we ask for 1 x 150s.
        # It should span across the high blocks?
        # This tests if the code crashes, not strict logic yet.
        plan = {"type": "time", "duration": 150, "reps": 1}
        result = IntervalDetector.detect(self.activity, plan)
        self.assertIn("interval_power_mean", result)

if __name__ == '__main__':
    unittest.main()
