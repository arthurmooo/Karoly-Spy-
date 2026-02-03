#!/usr/bin/env python3
"""
Inspect Steven's laps to understand the real structure.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser


def inspect_activity(activity_id: str, name: str):
    db = DBConnector()
    storage = StorageManager()

    result = db.client.table("activities").select("*").eq("id", activity_id).execute()
    if not result.data:
        print(f"Activity not found: {activity_id}")
        return

    act_data = result.data[0]
    fit_path = act_data.get("fit_file_path")

    print(f"\n{'='*80}")
    print(f"INSPECTING: {name}")
    print(f"Activity ID: {activity_id}")
    print(f"FIT Path: {fit_path}")
    print(f"{'='*80}")

    content = storage.download_fit_file(fit_path)
    with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    df, metadata, laps = UniversalParser.parse(tmp_path)
    os.unlink(tmp_path)

    print(f"\nTotal data points: {len(df)}")
    print(f"Total laps: {len(laps)}")

    # Print laps
    print(f"\n{'Lap':>4} | {'Start':>8} | {'End':>8} | {'Dur':>6} | {'Dist':>8} | {'Speed':>8} | {'Pace':>8} | {'HR':>6}")
    print("-" * 80)

    cumulative = 0
    for i, lap in enumerate(laps):
        dur = lap.get('total_timer_time') or lap.get('total_elapsed_time', 0)
        dist = lap.get('total_distance', 0)
        speed = lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)
        hr = lap.get('avg_heart_rate', 0)

        start = cumulative
        end = cumulative + int(dur)
        cumulative = end

        if speed > 0:
            pace_sec = 1000 / speed
            pace_min = int(pace_sec // 60)
            pace_sec_rem = int(pace_sec % 60)
            pace_str = f"{pace_min}'{pace_sec_rem:02d}\""
        else:
            pace_str = "-"

        print(f"{i+1:>4} | {start:>8} | {end:>8} | {dur:>6.0f} | {dist:>8.0f}m | {speed:>6.2f}m/s | {pace_str:>8} | {hr:>6.0f}")

    # Print high-intensity laps summary
    print(f"\n{'='*80}")
    print("HIGH-INTENSITY LAPS (Speed > 4.8 m/s)")
    print("="*80)

    high_intensity = [(i, lap) for i, lap in enumerate(laps)
                      if (lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)) > 4.8]

    for i, lap in high_intensity:
        dur = lap.get('total_timer_time') or lap.get('total_elapsed_time', 0)
        dist = lap.get('total_distance', 0)
        speed = lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)
        hr = lap.get('avg_heart_rate', 0)

        pace_sec = 1000 / speed
        pace_min = int(pace_sec // 60)
        pace_sec_rem = int(pace_sec % 60)
        pace_str = f"{pace_min}'{pace_sec_rem:02d}\""

        print(f"Lap {i+1}: {dur:.0f}s, {dist:.0f}m, {speed:.2f}m/s ({pace_str}), {hr:.0f}bpm")


if __name__ == "__main__":
    # Steven 3*5Km - 01/02/2026
    inspect_activity("53433168-97a8-4f80-bcf6-efd357734ee7", "Steven Galibert 3*5Km (01/02/2026)")

    # Steven 10*3' - 16/01/2026
    inspect_activity("3b7ddceb-e9e8-4c8b-9b3e-72b6dd1663a3", "Steven Galibert 10*3'/r1' (16/01/2026)")
