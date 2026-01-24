
import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta, timezone

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import UniversalParser

FILES = {
    "Adrien_2026-01-07": "data/test_cache/Adrien_2026-01-07.fit",
    "Baptiste_2026-01-09": "data/test_cache/Baptiste_2026-01-09.fit",
    "Alexis_2025-10-17": "data/test_cache/Bernard_2025-10-17.fit", # Bernard Alexis
    "Dries_2026-01-17": "data/test_cache/Dries_2026-01-17.fit"
}

def get_laps_ground_truth(file_path):
    df, meta, laps = UniversalParser.parse(file_path)
    
    if 'timestamp' in df.columns:
        df = df.set_index('timestamp')
    
    # We want to extract intervals that are likely "Active" or the main part of the workout
    # For benchmarking, we will use the Laps as they were recorded on the watch.
    
    gt_intervals = []
    for lap in laps:
        start = lap.get('start_time')
        if not start: continue
        
        if isinstance(start, str):
            start = pd.to_datetime(start, utc=True)
        elif isinstance(start, datetime) and start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
            
        dur = lap.get('total_timer_time', lap.get('total_elapsed_time', 0))
        if dur < 10: continue # Skip very short laps (button errors)
        
        end = start + timedelta(seconds=dur)
        
        # Calculate some metrics for the lap to have in the ground truth
        lap_df = df[(df.index >= start) & (df.index <= end)]
        if lap_df.empty: continue
        
        metrics = {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "duration": dur,
            "avg_hr": float(lap_df['heart_rate'].mean()) if 'heart_rate' in lap_df.columns else None,
            "avg_speed": float(lap_df['speed'].mean()) if 'speed' in lap_df.columns else None,
            "avg_power": float(lap_df['power'].mean()) if 'power' in lap_df.columns else None,
        }
        gt_intervals.append(metrics)
    
    return gt_intervals

def main():
    ground_truth = {}
    for key, path in FILES.items():
        print(f"Processing {key}...")
        try:
            ground_truth[key] = get_laps_ground_truth(path)
            print(f"  Found {len(ground_truth[key])} laps.")
        except Exception as e:
            print(f"  Error: {e}")
            
    with open("data/test_cache/benchmark_ground_truth.json", "w") as f:
        json.dump(ground_truth, f, indent=2)
    print("Done. Saved to data/test_cache/benchmark_ground_truth.json")

if __name__ == "__main__":
    main()
