
import unittest
import pandas as pd
import numpy as np
from projectk_core.logic.plan_driven_seeker import PlanDrivenSeeker

class TestPlanDrivenSeeker(unittest.TestCase):
    
    def test_basic_seek(self):
        """
        Test finding a 60s interval in a 300s signal with a 10s offset.
        """
        # 1. Create signal: 100s baseline, 60s effort (starts at 110s), 140s baseline
        # Effort starts 10s after what might be expected if we just look at the first rise.
        signal = np.full(300, 100.0)
        signal[110:170] = 300.0
        df = pd.DataFrame({'power': signal})
        
        seeker = PlanDrivenSeeker(df, primary_signal='power')
        
        # We expect a 60s interval. We search around index 100.
        match = seeker.seek(target_duration=60, expected_start=100, search_window=30)
        
        self.assertIsNotNone(match)
        self.assertEqual(match['start'], 110)
        self.assertEqual(match['end'], 170)

    def test_active_recovery_separation(self):
        """
        Bernard Alexis Case: 1'30 Effort (400W) followed by 3'30 Active Recovery (250W).
        The total block is 5' (300s) of 'higher than usual' power.
        The seeker must find the 90s effort block precisely.
        """
        # 0-60s: Warmup 150W
        # 60-150s: EFFORT 400W (90s)
        # 150-360s: ACTIVE RECOVERY 250W (210s)
        # 360-420s: Cool down 150W
        signal = np.full(420, 150.0)
        signal[60:150] = 400.0
        signal[150:360] = 250.0
        df = pd.DataFrame({'power': signal})
        
        seeker = PlanDrivenSeeker(df, primary_signal='power')
        
        # Search for 90s effort around expected start 60s
        match = seeker.seek(target_duration=90, expected_start=60, search_window=20)
        
        self.assertIsNotNone(match)
        self.assertEqual(match['start'], 60)
        self.assertEqual(match['end'], 150)

    def test_noisy_signal(self):
        """
        Test robustness with noise.
        """
        np.random.seed(42)
        signal = np.full(300, 150.0) + np.random.normal(0, 10, 300)
        signal[100:200] = 350.0 + np.random.normal(0, 20, 100)
        df = pd.DataFrame({'power': signal})
        
        seeker = PlanDrivenSeeker(df, primary_signal='power')
        match = seeker.seek(target_duration=100, expected_start=100, search_window=30)
        
        self.assertIsNotNone(match)
        # Should be very close to 100 and 200
        self.assertLess(abs(match['start'] - 100), 2)
        self.assertLess(abs(match['end'] - 200), 2)

    def test_multi_signal_refinement(self):
        """
        Test that cadence helps refine the start/end.
        In this case, power rises slowly but cadence jumps exactly at 100.
        """
        # Power rises from 150 to 350 over 10s (95 to 105)
        power = np.full(300, 150.0)
        power[95:105] = np.linspace(150, 350, 10)
        power[105:200] = 350.0
        
        # Cadence jumps at 100
        cadence = np.full(300, 80.0)
        cadence[100:200] = 95.0
        
        df = pd.DataFrame({'power': power, 'cadence': cadence})
        
        seeker = PlanDrivenSeeker(df, primary_signal='power')
        match = seeker.seek(target_duration=100, expected_start=100, search_window=30)
        
        self.assertIsNotNone(match)
        # Without cadence, max power gradient might be in the middle of the ramp.
        # With cadence, it should snap closer to 100.
        self.assertLess(abs(match['start'] - 100), 2)

if __name__ == '__main__':
    unittest.main()
