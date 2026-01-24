import unittest
from projectk_core.processing.interval_matcher import IntervalMatcher

class TestConsistencyScore(unittest.TestCase):
    def setUp(self):
        self.matcher = IntervalMatcher()

    def test_perfect_match(self):
        # 10x 30s
        targets = [{"duration": 30, "type": "active"}] * 10
        laps = [{"total_elapsed_time": 30, "avg_power": 300, "avg_speed": 0}] * 10 # 10 perfect laps
        
        # We need to ensure laps are classified as 'work' or we pass signal_col='power'
        # validate_laps needs to know signal_col to classify intensity?
        # Or we pre-process laps.
        # Let's assume validate_laps handles preprocessing or accepts raw laps.
        score = self.matcher.validate_laps(laps, targets, signal_col='power')
        self.assertGreater(score, 0.9)

    def test_extra_laps(self):
        # 10 targets, 12 laps (warmup, cooldown)
        targets = [{"duration": 30, "type": "active"}] * 10
        # Warmup (low power), 10 Intervals (high power), Cooldown
        laps = [{"total_elapsed_time": 600, "avg_power": 100}] + \
               [{"total_elapsed_time": 30, "avg_power": 300}] * 10 + \
               [{"total_elapsed_time": 600, "avg_power": 100}]
               
        score = self.matcher.validate_laps(laps, targets, signal_col='power')
        self.assertGreater(score, 0.8) # Should still find the structure

    def test_missing_laps(self):
        # 10 targets, 8 laps
        targets = [{"duration": 30, "type": "active"}] * 10
        laps = [{"total_elapsed_time": 30, "avg_power": 300}] * 8
        
        score = self.matcher.validate_laps(laps, targets, signal_col='power')
        self.assertLess(score, 0.9) # Mismatch (8/10 = 0.8)

    def test_duration_mismatch(self):
        # 10 targets of 30s, laps are 60s
        targets = [{"duration": 30, "type": "active"}] * 10
        laps = [{"total_elapsed_time": 60, "avg_power": 300}] * 10
        
        score = self.matcher.validate_laps(laps, targets, signal_col='power')
        self.assertLess(score, 0.5)

if __name__ == '__main__':
    unittest.main()
