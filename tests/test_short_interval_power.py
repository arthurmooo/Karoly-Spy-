import pytest
import pandas as pd
import numpy as np
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.config_manager import AthleteConfig

def test_short_interval_power_reproduction():
    """
    Reproduction case for Seraphin Barbot's session (27/01/2026).
    Short sprints (<15s) are reported with low power (e.g. 278W) instead of high power (~600W+).
    """
    fit_path = "data/samples/seraphin_sprint_None.fit"
    
    # 1. Parse
    df, meta, laps = UniversalParser.parse(fit_path)
    assert not df.empty, "DataFrame should not be empty"
    
    # 2. Construct Activity
    # We need a minimal metadata object
    activity_meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="Test Sprint",
        start_time=meta.get("start_time"),
        duration_sec=1000,
        distance_m=10000
    )
    activity = Activity(metadata=activity_meta, streams=df, laps=laps)
    
    # 3. Calculate Metrics (using default config)
    config = AthleteConfig()
    calculator = MetricsCalculator(config)
    
    # We rely on the calculator to detect intervals or we manually focus on specific laps?
    # The issue is likely in how intervals are processed when they are detected.
    # But first, let's see what the calculator produces if we force it to evaluate the specific Sprint Laps.
    
    # In the real pipeline, 'intervals' are detected via `ActivityClassifier` or `IntervalDetector`.
    # However, for this bug, we want to check the *calculation* logic given a start/end time.
    
    # Let's pick a known sprint lap.
    # Lap 12: 10s, 687W (Device). Start index can be inferred from accumulation of previous laps?
    # Or better, we can use the 'laps' list which UniversalParser fills with start_time/timestamp.
    
    # UniversalParser laps usually have 'start_index' and 'end_index' relative to the DataFrame if parsed correctly.
    # Let's check if 'laps' have indices.
    
    lap_12 = laps[12]
    # We expect high power here.
    device_power = lap_12.get('avg_power')
    print(f"Lap 12 Device Power: {device_power}")
    
    # Map timestamps to find indices
    start_ts = lap_12.get('start_time')
    # Note: 'timestamp' in lap is the END timestamp usually. 'start_time' is the start.
    
    # Ensure start_ts is tz-aware if df is tz-aware
    # df timestamps are usually UTC tz-aware in Project K
    
    # Find start index
    # We look for the first timestamp >= start_ts
    start_idx = df[df['timestamp'] >= start_ts].index[0]
    
    # Find end index (approximate duration)
    # Or use the next lap's start? Or just duration?
    duration = lap_12.get('total_timer_time')
    end_ts = start_ts + pd.Timedelta(seconds=duration)
    
    # End index is the last timestamp <= end_ts
    end_idx = df[df['timestamp'] <= end_ts].index[-1]
    
    print(f"Mapped Indices: {start_idx} to {end_idx} (Duration: {duration}s)")

    
    # Extract from streams
    slice_df = df.iloc[start_idx:end_idx]
    
    # Raw calculation (Simple Mean)
    raw_mean_power = slice_df['power'].mean()
    print(f"Lap 12 Raw Mean Power (Pandas): {raw_mean_power}")
    
    # The Bug: The system likely calculates something different.
    # Let's check what `MetricCalculator` or `IntervalMetrics` does.
    # Since I cannot easily invoke the full IntervalEngine here without setup, 
    # I will assert that the *Raw Mean* is close to *Device Power*.
    # If Raw Mean is also low, then the data stream itself is the issue (e.g. alignment).
    # If Raw Mean is high, but the *system* reports low, then the aggregation logic is wrong.
    
    # Hypothesis: The system might include zeros or adjacent rest periods.
    
    # Assert that Raw Mean is consistent with Device Power
    # Tolerance 5%
    assert abs(raw_mean_power - device_power) < (device_power * 0.05), \
        f"Raw stream mean {raw_mean_power} differs from device lap power {device_power}"

    # ... (previous setup) ...

    # 4. Test Fallback Mode (No Plan)
    # We expect the Lap Logic to pick up the high power laps if they are above average.
    # Note: detect_work_type needs to return "intervals" for this to happen.
    # We force work_type = "intervals" in the metadata or mock the classifier.
    
    activity.metadata.work_type = "intervals"
    
    print("\n--- Testing Fallback (Lap) Mode ---")
    metrics_fallback = calculator.compute(activity, nolio_type="training", target_grid=None)
    
    # Check 'intervals' in metrics
    detected_fallback = metrics_fallback.get('intervals', [])
    print(f"Fallback detected {len(detected_fallback)} intervals")
    
    # We expect some intervals to be ~600W+
    # Let's check the distribution
    powers_fallback = [d.avg_power for d in detected_fallback if d.avg_power]
    max_fallback = max(powers_fallback) if powers_fallback else 0
    print(f"Max Fallback Power: {max_fallback}")
    
    # If Fallback works, max should be > 600
    if max_fallback < 500:
        print("❌ Fallback Mode failed to capture high power sprints!")
    else:
        print("✅ Fallback Mode captured high power.")

    # 5. Test Surgical Mode (With Plan)
    # Construct a mock target_grid for 15 * (10s Work, 50s Rest)
    # We will just make a few steps to match the middle of the file
    
    # We found sprints at Lap 10, 12, 14...
    # Lap 10 is 10s.
    # Let's try to target these.
    
    target_grid = []
    # Create 20 reps of 10s Work
    for i in range(20):
        target_grid.append({"type": "active", "duration": 10, "intensity": "high"})
        target_grid.append({"type": "recovery", "duration": 50, "intensity": "low"})
        
    print("\n--- Testing Surgical (Matcher) Mode ---")
    metrics_surgical = calculator.compute(activity, nolio_type="training", target_grid=target_grid)
    
    detected_surgical = metrics_surgical.get('intervals', [])
    print(f"Surgical detected {len(detected_surgical)} intervals")
    
    powers_surgical = [d.avg_power for d in detected_surgical if d.type == 'active' and d.avg_power]
    if not powers_surgical:
        print("❌ Surgical Mode found NO active intervals with power!")
    else:
        max_surgical = max(powers_surgical)
        avg_top3_surgical = np.mean(sorted(powers_surgical)[-3:])
        print(f"Max Surgical Power: {max_surgical}")
        print(f"Avg Top 3 Surgical: {avg_top3_surgical}")
        
        # THIS IS THE BUG REPRODUCTION
        # If max_surgical is low (e.g. ~278W), we found the bug.
        if max_surgical < 500:
             pytest.fail(f"BUG REPRODUCED: Surgical Mode max power {max_surgical} is too low (Expected > 500W)")


if __name__ == "__main__":
    test_short_interval_power_reproduction()
