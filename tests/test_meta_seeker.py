import unittest
import pandas as pd
import numpy as np
from projectk_core.logic.meta_seeker import MetaSeeker

class TestMetaSeeker(unittest.TestCase):
    def setUp(self):
        # Create a synthetic 1Hz signal with a sharp rise at 10s
        self.times = np.arange(100)
        self.power = np.zeros(100)
        self.power[10:] = 300 # Sharp rise at 10s (jump between 9 and 10)
        
        self.df = pd.DataFrame({
            'time': self.times,
            'power': self.power,
            'cadence': np.where(self.times >= 10, 90, 0)
        })
        
    def test_meta_precision_no_lag(self):
        # Without lag compensation, should find exactly the signal transition center
        seeker = MetaSeeker(self.df, primary_signal='power', resolution_hz=10, use_lag_compensation=False)
        # Gradient max at 9.5
        res = seeker.seek(target_duration=10, expected_start=10, search_window=5)
        self.assertIsNotNone(res)
        self.assertAlmostEqual(res['meta_start'], 9.5, places=1)
        self.assertEqual(res['start'], 10) # Rounded 9.5 is 10

    def test_lag_compensation(self):
        # Rise at 12s. Max gradient at 11.5. Real = 11.5 - 0.5 = 11.0.
        power_lagged = np.zeros(100)
        power_lagged[12:] = 300
        df = pd.DataFrame({'time': self.times, 'power': power_lagged})
        
        seeker = MetaSeeker(df, primary_signal='power', use_lag_compensation=True)
        res = seeker.seek(target_duration=10, expected_start=12, search_window=5)
        self.assertEqual(res['start'], 11)
        self.assertAlmostEqual(res['meta_start'], 11.0, places=1)

if __name__ == '__main__':
    unittest.main()