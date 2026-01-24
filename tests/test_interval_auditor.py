import unittest
import pandas as pd
from datetime import datetime, timedelta
# Assuming we will create this class
from projectk_core.logic.interval_auditor import IntervalAuditor

class TestIntervalAuditor(unittest.TestCase):
    def setUp(self):
        # Create a mock dataframe for an activity
        # 10 Hz data for 100 seconds
        time_index = pd.date_range(start="2026-01-01 10:00:00", periods=1000, freq="100ms")
        self.df = pd.DataFrame({
            "heart_rate": [140] * 500 + [160] * 500, # 50s at 140, 50s at 160
            "speed": [3.0] * 1000, # 3 m/s
            "power": [200] * 1000, # 200 W
            "timestamp": time_index
        })
        self.df.set_index("timestamp", inplace=True)
        
        # Mock Activity Object
        self.mock_activity = type("Activity", (), {})()
        self.mock_activity.df = self.df
        self.mock_activity.sport = "Running"

    def test_audit_intervals_running(self):
        # Define mock intervals (start, end)
        # Interval 1: 0-50s (HR 140)
        # Interval 2: 50-100s (HR 160)
        t0 = self.df.index[0]
        intervals = [
            {"start_time": t0, "end_time": t0 + timedelta(seconds=50)},
            {"start_time": t0 + timedelta(seconds=50), "end_time": t0 + timedelta(seconds=100)}
        ]

        auditor = IntervalAuditor(self.mock_activity)
        report = auditor.audit(intervals)

        self.assertEqual(len(report), 2)
        
        # Check Interval 1
        self.assertAlmostEqual(report[0]["duration_sec"], 50.0, places=1)
        self.assertAlmostEqual(report[0]["avg_hr"], 140.0, places=1)
        self.assertAlmostEqual(report[0]["avg_speed"], 3.0, places=1)
        self.assertNotIn("avg_power", report[0]) # Should prefer speed for Running? Or maybe both? 
        # Spec says: "Contextuel Sport : Avg Speed (pour Run) OU Avg Power (pour Bike)."

    def test_audit_intervals_cycling(self):
        self.mock_activity.sport = "Cycling"
        t0 = self.df.index[0]
        intervals = [
            {"start_time": t0, "end_time": t0 + timedelta(seconds=50)}
        ]
        
        auditor = IntervalAuditor(self.mock_activity)
        report = auditor.audit(intervals)
        
        self.assertAlmostEqual(report[0]["avg_power"], 200.0, places=1)
        self.assertNotIn("avg_speed", report[0]) # Depending on implementation preference
