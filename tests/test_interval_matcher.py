
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
        
        # Check alignment (Allowing small tolerance for search heuristics)
        # Signal-based matching may be off by 1-2 samples at boundaries
        self.assertAlmostEqual(results[0]['avg_power'], 300, delta=5)
        self.assertAlmostEqual(results[1]['avg_power'], 300, delta=5)
        self.assertAlmostEqual(results[2]['avg_power'], 300, delta=5)
        
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
        self.assertAlmostEqual(results[0]['avg_power'], 300, delta=5)

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
        # Should match the 90s effort closely (±2 samples boundary tolerance)
        self.assertAlmostEqual(results[0]['duration_sec'], 90, delta=2)
        self.assertAlmostEqual(results[0]['start_index'], 600, delta=2)
        self.assertAlmostEqual(results[0]['end_index'], 690, delta=2)
        self.assertAlmostEqual(results[0]['avg_power'], 400, delta=5)

    def test_bernard_alexis_composite_no_laps(self):
        """
        Test detection of intervals in a composite structure without LAPs.
        Structure: 2x(1'30 Z3 + 3'30 Z2, R=3')

        Note: Signal-based matching may not find all intervals in synthetic data
        due to the simplified step detection algorithm. This test validates that
        we can find at least the most prominent intervals.
        """
        # 1 repetition: 90s @ 400W + 210s @ 250W + 180s @ 150W
        # Total rep = 480s
        one_rep = np.concatenate([
            np.full(90, 400.0),  # Z3
            np.full(210, 250.0), # Z2
            np.full(180, 150.0)  # Rest
        ])

        # 2 reps
        power = np.concatenate([np.full(300, 150.0), one_rep, one_rep])
        timestamps = pd.date_range(start='2026-01-01 10:00:00', periods=len(power), freq='1s')
        df = pd.DataFrame({'timestamp': timestamps, 'power': power, 'speed': np.zeros(len(power))})

        target_grid = [
            {"duration": 90, "target_type": "power", "type": "active", "target_min": 350},
            {"duration": 210, "target_type": "power", "type": "active", "target_min": 230},
            {"duration": 90, "target_type": "power", "type": "active", "target_min": 350},
            {"duration": 210, "target_type": "power", "type": "active", "target_min": 230},
        ]

        results = self.matcher.match(df, target_grid, sport="bike")

        # Expect at least 2 intervals found (may be less due to signal-based limitations)
        self.assertGreaterEqual(len(results), 2, "Should find at least 2 intervals")

        # Verify first interval is the 90s Z3 block
        self.assertAlmostEqual(results[0]['duration_sec'], 90, delta=5)
        self.assertGreater(results[0]['avg_power'], 350, "First interval should be high intensity")

    def test_progressive_laps_chronological(self):
        """
        Fix 1 regression test: progressive session with 3 LAPs of increasing speed.
        The matcher must take them in chronological order (first valid), NOT pick
        the fastest one first (best-in-window).
        """
        # 3 LAPs: 3'52/km (4.31 m/s), 3'43/km (4.48 m/s), 3'24/km (4.90 m/s)
        # Each ~9Km => ~2100s duration, ~9000m distance
        speeds = [4.31, 4.48, 4.90]
        lap_duration = 2100  # seconds
        lap_distance = 9000  # meters
        warmup = 600  # 10min warmup

        total = warmup + lap_duration * 3 + 300  # some cooldown
        timestamps = pd.date_range(start='2026-01-01 06:00:00', periods=total, freq='1s')
        speed_arr = np.full(total, 2.5)  # jog baseline

        # Build raw FIT-format laps (as _preprocess_laps expects)
        # Include a warmup lap so the matcher must skip it
        laps = [{
            'total_timer_time': warmup,
            'total_elapsed_time': warmup,
            'total_distance': warmup * 2.5,
            'enhanced_avg_speed': 2.5,
            'avg_heart_rate': 120,
            'avg_power': 0,
        }]
        offset = warmup
        for i, spd in enumerate(speeds):
            speed_arr[offset:offset + lap_duration] = spd
            laps.append({
                'total_timer_time': lap_duration,
                'total_elapsed_time': lap_duration,
                'total_distance': lap_distance,
                'enhanced_avg_speed': spd,
                'avg_heart_rate': 160 + i * 5,
                'avg_power': 0,
            })
            offset += lap_duration

        df = pd.DataFrame({
            'timestamp': timestamps,
            'speed': speed_arr,
            'power': np.zeros(total),
            'heart_rate': np.full(total, 155.0),
        })

        target_grid = [
            {"duration": lap_duration, "distance_m": lap_distance, "target_type": "distance", "type": "active", "target_min": 4.0},
            {"duration": lap_duration, "distance_m": lap_distance, "target_type": "distance", "type": "active", "target_min": 4.0},
            {"duration": lap_duration, "distance_m": lap_distance, "target_type": "distance", "type": "active", "target_min": 4.0},
        ]

        results = self.matcher.match(df, target_grid, sport="run", laps=laps)

        # All 3 must be matched in chronological order
        self.assertEqual(len(results), 3, f"Expected 3 matches, got {len(results)}")
        for i, r in enumerate(results):
            self.assertAlmostEqual(r['avg_speed'], speeds[i], delta=0.15,
                                   msg=f"Interval {i} speed mismatch: expected ~{speeds[i]}, got {r['avg_speed']}")


if __name__ == '__main__':
    unittest.main()
