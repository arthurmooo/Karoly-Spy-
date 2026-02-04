#!/usr/bin/env python3
"""
Inspect new test cases to understand their LAP structure.
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

    # Print high-intensity laps summary based on expected intensities
    print(f"\n{'='*80}")
    print("HIGH-INTENSITY LAPS (Speed > 4.2 m/s for LT1, > 4.4 m/s for Tempo)")
    print("="*80)

    high_intensity = [(i, lap) for i, lap in enumerate(laps)
                      if (lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)) > 4.2]

    for i, lap in high_intensity:
        dur = lap.get('total_timer_time') or lap.get('total_elapsed_time', 0)
        dist = lap.get('total_distance', 0)
        speed = lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)
        hr = lap.get('avg_heart_rate', 0)

        if speed > 0:
            pace_sec = 1000 / speed
            pace_min = int(pace_sec // 60)
            pace_sec_rem = int(pace_sec % 60)
            pace_str = f"{pace_min}'{pace_sec_rem:02d}\""
        else:
            pace_str = "-"

        print(f"Lap {i+1}: {dur:.0f}s, {dist:.0f}m, {speed:.2f}m/s ({pace_str}), {hr:.0f}bpm")


if __name__ == "__main__":
    # Adrien Claeyssen 31/01/2026 - 2*7Km Tempo / r 1Km
    # SOT: 3'41/km = 4.52 m/s, 163 bpm
    inspect_activity("0b906793-9d76-4844-a72b-3093dc2fe231", "Adrien Claeyssen 2*7Km Tempo (31/01/2026)")

    # Steven Galibert 26/01/2026 - 3*10Km LT1 / r 2Km
    # SOT: 3'52/km = 4.31 m/s, 147 bpm
    inspect_activity("c3f94ffb-7b0b-41bd-a1a4-f5a094332329", "Steven Galibert 3*10Km LT1 (26/01/2026)")
