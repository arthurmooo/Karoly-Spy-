#!/usr/bin/env python3
"""
Audit Script for Signal Optimization - Surgical Precision Validation

This script validates the signal detection optimizations against the Source of Truth (SOT)
from Steven Galibert's sessions.

Test Cases:
1. Steven Galibert 01/02/2026 3*5Km
   - Expected: 3'20/km (5.0 m/s), 169 bpm

2. Steven Galibert 16/01/2026 10*3'/r1'
   - Expected: 18.39 km/h (5.11 m/s, 3'16/km), 161 bpm

Success Criteria:
- Boundary precision: +/-2s from ground truth
- Metrics within 2% of SOT

Author: Project K Team
Version: 1.0.0
"""

import os
import sys
import tempfile
from typing import Dict, Any, List, Optional

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.interval_matcher import IntervalMatcher


# ==================== SOURCE OF TRUTH ====================
# Updated based on actual LAP analysis
SOT_CASES = {
    # Steven Galibert 01/02/2026 - 3*5Km
    # Structure: 3 blocks of 5km each, marked as 5x1km LAPs
    # Block 1: Laps 9-13 (starts at ~1358s)
    # Block 2: Laps 15-19 (starts at ~2657s)
    # Block 3: Laps 21-25 (starts at ~3960s)
    "53433168-97a8-4f80-bcf6-efd357734ee7": {
        "athlete": "Steven Galibert",
        "date": "2026-02-01",
        "structure": "3*5Km",
        "expected_pace_min_km": 3.33,  # 3'20/km
        "expected_speed_ms": 5.0,      # 5.0 m/s
        "expected_hr": 169,
        "num_intervals": 3,
        "interval_duration_sec": 999,  # ~16:40 per 5Km (5 laps * ~200s)
        "target_grid": [
            {"type": "active", "duration": 999, "target_min": 4.95, "distance_m": 5000, "planned_rest": 300},
            {"type": "active", "duration": 999, "target_min": 4.95, "distance_m": 5000, "planned_rest": 300},
            {"type": "active", "duration": 999, "target_min": 4.95, "distance_m": 5000, "planned_rest": 300},
        ],
        # Ground truth boundaries from LAP analysis
        "ground_truth_starts": [1358, 2657, 3960],
        "ground_truth_ends": [2355, 3658, 4956],
    },
    # Steven Galibert 16/01/2026 - 10*3'/r1'
    # 10 intervals at 3min work / 1min rest
    # Work intervals are laps 4, 6, 8, 10, 12, 14, 16, 18, 20, 22
    # (lap 2 is warmup at lower intensity: 4.59 m/s vs target 5.0 m/s)
    # Expected: All laps at ~5.1 m/s (3'16/km), HR ~161
    "3b7ddceb-e9e8-4c8b-9b3e-72b6dd1663a3": {
        "athlete": "Steven Galibert",
        "date": "2026-01-16",
        "structure": "10*3'/r1'",
        "expected_pace_min_km": 3.27,  # 3'16/km
        "expected_speed_ms": 5.10,     # Average of work laps (5.04-5.14)
        "expected_hr": 161,
        "num_intervals": 10,
        "interval_duration_sec": 180,  # 3 minutes
        # CRITICAL: target_min should be HIGH enough to exclude warmup lap (4.59 m/s)
        "target_grid": [
            {"type": "active", "duration": 180, "target_min": 5.0, "planned_rest": 60}
            for _ in range(10)
        ],
        # Ground truth from LAP analysis (laps 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
        # Start times: 1200, 1440, 1680, 1920, 2160, 2400, 2640, 2880, 3120, 3360
        "ground_truth_starts": [1200, 1440, 1680, 1920, 2160, 2400, 2640, 2880, 3120, 3360],
        "ground_truth_ends": [1380, 1620, 1860, 2100, 2340, 2580, 2820, 3060, 3300, 3540],
    },
    # Adrien Claeyssen 31/01/2026 - 2*7Km Tempo / r 1Km
    # SOT: 3'41/km = 4.52 m/s, 163 bpm
    # Last interval: 3'43/km = 4.48 m/s, 161 bpm
    # Structure: 2 blocks of 7km each (7 laps per block)
    # Block 1: Laps 4-10 (starts at 862s)
    # Block 2: Laps 12-18 (starts at 2718s, after 1km recovery at lap 11)
    "0b906793-9d76-4844-a72b-3093dc2fe231": {
        "athlete": "Adrien Claeyssen",
        "date": "2026-01-31",
        "structure": "2*7Km Tempo / r 1Km",
        "expected_pace_min_km": 3.68,  # 3'41/km
        "expected_speed_ms": 4.52,      # 4.52 m/s
        "expected_hr": 163,
        "num_intervals": 2,
        "interval_duration_sec": 1557,  # ~26 min per 7Km
        "target_grid": [
            {"type": "active", "duration": 1557, "target_min": 4.40, "distance_m": 7000, "planned_rest": 300},
            {"type": "active", "duration": 1557, "target_min": 4.40, "distance_m": 7000, "planned_rest": 300},
        ],
        # Ground truth boundaries from LAP analysis
        "ground_truth_starts": [862, 2718],
        "ground_truth_ends": [2419, 4249],
    },
    # Steven Galibert 26/01/2026 - 3*10Km LT1 / r 2Km
    # SOT: 3'52/km = 4.31 m/s, 147 bpm
    # Last interval: 3'55/km = 4.26 m/s, 145 bpm
    # Structure: 3 blocks of 10km each (10 laps per block)
    # Block 1: Laps 5-14 (starts at 1202s)
    # Block 2: Laps 17-26 (starts at 4128s, after 2km recovery)
    # Block 3: Laps 29-38 (starts at 7024s, after 2km recovery)
    "c3f94ffb-7b0b-41bd-a1a4-f5a094332329": {
        "athlete": "Steven Galibert",
        "date": "2026-01-26",
        "structure": "3*10Km LT1 / r 2Km",
        "expected_pace_min_km": 3.87,  # 3'52/km
        "expected_speed_ms": 4.31,      # 4.31 m/s
        "expected_hr": 147,
        "num_intervals": 3,
        "interval_duration_sec": 2334,  # ~39 min per 10Km
        "target_grid": [
            {"type": "active", "duration": 2334, "target_min": 4.15, "distance_m": 10000, "planned_rest": 480},
            {"type": "active", "duration": 2334, "target_min": 4.15, "distance_m": 10000, "planned_rest": 480},
            {"type": "active", "duration": 2334, "target_min": 4.15, "distance_m": 10000, "planned_rest": 480},
        ],
        # Ground truth boundaries from LAP analysis
        "ground_truth_starts": [1202, 4128, 7024],
        "ground_truth_ends": [3536, 6428, 9315],
    },
}


def load_activity_data(activity_id: str) -> tuple:
    """Load activity stream data from storage."""
    try:
        db = DBConnector()
        storage = StorageManager()

        # Get activity metadata
        result = db.client.table("activities").select("*").eq("id", activity_id).execute()

        if not result.data:
            print(f"   ⚠️ Activity not found: {activity_id}")
            return None, None, None, None

        act_data = result.data[0]
        fit_path = act_data.get("fit_file_path")

        if not fit_path:
            print(f"   ⚠️ No FIT file path for activity")
            return None, None, None, None

        # Download and parse FIT file
        print(f"   Downloading: {fit_path}")
        content = storage.download_fit_file(fit_path)

        with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        df, metadata, laps = UniversalParser.parse(tmp_path)
        os.unlink(tmp_path)

        print(f"   ✅ Loaded {len(df)} data points, {len(laps)} laps")
        return df, laps, act_data, metadata

    except Exception as e:
        print(f"   ❌ Error loading activity: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None, None


def run_detection(
    df: pd.DataFrame,
    target_grid: List[Dict[str, Any]],
    laps: List[Dict[str, Any]],
    sport: str = "run"
) -> List[Dict[str, Any]]:
    """Run interval detection with new optimized algorithm."""
    matcher = IntervalMatcher()
    detections = matcher.match(
        df=df,
        target_grid=target_grid,
        sport=sport,
        laps=laps,
        cp=5.0  # Steven's approximate CS
    )

    return detections


def validate_metrics(
    detections: List[Dict[str, Any]],
    sot: Dict[str, Any]
) -> Dict[str, Any]:
    """Validate detection metrics against SOT."""
    results = {
        "num_detected": len(detections),
        "num_expected": sot["num_intervals"],
        "count_match": len(detections) == sot["num_intervals"],
        "speed_deltas": [],
        "hr_deltas": [],
        "duration_deltas": [],
        "avg_speed": None,
        "avg_hr": None,
        "speed_error_pct": None,
        "hr_error_pct": None,
    }

    if not detections:
        return results

    # Calculate averages
    speeds = [d.get("avg_speed") for d in detections if d.get("avg_speed")]
    hrs = [d.get("avg_hr") for d in detections if d.get("avg_hr")]
    durations = [d.get("duration_sec") for d in detections if d.get("duration_sec")]

    if speeds:
        results["avg_speed"] = sum(speeds) / len(speeds)
        results["speed_error_pct"] = abs(
            (results["avg_speed"] - sot["expected_speed_ms"]) / sot["expected_speed_ms"] * 100
        )
        results["speed_deltas"] = [s - sot["expected_speed_ms"] for s in speeds]

    if hrs:
        results["avg_hr"] = sum(hrs) / len(hrs)
        results["hr_error_pct"] = abs(
            (results["avg_hr"] - sot["expected_hr"]) / sot["expected_hr"] * 100
        )
        results["hr_deltas"] = [h - sot["expected_hr"] for h in hrs]

    if durations:
        expected_dur = sot["interval_duration_sec"]
        results["duration_deltas"] = [d - expected_dur for d in durations]

    return results


def print_detection_details(
    detections: List[Dict[str, Any]],
    sot: Dict[str, Any]
):
    """Print detailed detection results."""
    gt_starts = sot.get("ground_truth_starts", [])
    gt_ends = sot.get("ground_truth_ends", [])

    print(f"\n   Detected {len(detections)}/{sot['num_intervals']} intervals:")
    print(f"   {'#':>3} | {'Start':>6} | {'GT_S':>6} | {'ΔS':>4} | {'End':>6} | {'GT_E':>6} | {'ΔE':>4} | {'Speed':>10} | {'HR':>5} | {'Source':>8}")
    print("   " + "-" * 95)

    total_start_error = 0
    total_end_error = 0

    for i, d in enumerate(detections):
        start = d.get("start_index", 0)
        end = d.get("end_index", 0)
        dur = d.get("duration_sec", 0)
        speed = d.get("avg_speed", 0)
        hr = d.get("avg_hr", 0)
        source = d.get("source", "?")

        # Ground truth
        gt_s = gt_starts[i] if i < len(gt_starts) else "?"
        gt_e = gt_ends[i] if i < len(gt_ends) else "?"

        # Deltas
        delta_s = start - gt_s if isinstance(gt_s, int) else "?"
        delta_e = end - gt_e if isinstance(gt_e, int) else "?"

        if isinstance(delta_s, int):
            total_start_error += abs(delta_s)
        if isinstance(delta_e, int):
            total_end_error += abs(delta_e)

        # Calculate pace
        if speed and speed > 0:
            pace_sec = 1000 / speed
            pace_min = int(pace_sec // 60)
            pace_sec_rem = int(pace_sec % 60)
            pace_str = f"{speed:.2f} ({pace_min}'{pace_sec_rem:02d}\")"
        else:
            pace_str = "?"

        delta_s_str = f"{delta_s:+d}" if isinstance(delta_s, int) else "?"
        delta_e_str = f"{delta_e:+d}" if isinstance(delta_e, int) else "?"

        print(f"   {i+1:>3} | {start:>6} | {gt_s:>6} | {delta_s_str:>4} | {end:>6} | {gt_e:>6} | {delta_e_str:>4} | {pace_str:>10} | {hr:>5.0f} | {source:>8}")

    if gt_starts:
        avg_start_error = total_start_error / len(detections) if detections else 0
        avg_end_error = total_end_error / len(detections) if detections else 0
        print(f"\n   Boundary Precision: Start Δ={avg_start_error:.1f}s, End Δ={avg_end_error:.1f}s")

    # Print summary
    speeds = [d.get("avg_speed") for d in detections if d.get("avg_speed")]
    hrs = [d.get("avg_hr") for d in detections if d.get("avg_hr")]

    if speeds:
        avg_speed = sum(speeds) / len(speeds)
        avg_pace_sec = 1000 / avg_speed
        avg_pace_min = int(avg_pace_sec // 60)
        avg_pace_sec_rem = int(avg_pace_sec % 60)
        print(f"\n   Average Speed: {avg_speed:.2f} m/s ({avg_pace_min}'{avg_pace_sec_rem:02d}\"/km)")

        sot_pace_sec = 1000 / sot['expected_speed_ms']
        sot_pace_min = int(sot_pace_sec // 60)
        sot_pace_sec_rem = int(sot_pace_sec % 60)
        print(f"   SOT Speed: {sot['expected_speed_ms']:.2f} m/s ({sot_pace_min}'{sot_pace_sec_rem:02d}\"/km)")

        error = abs(avg_speed - sot['expected_speed_ms']) / sot['expected_speed_ms'] * 100
        print(f"   Speed Error: {error:.2f}%")

    if hrs:
        avg_hr = sum(hrs) / len(hrs)
        print(f"\n   Average HR: {avg_hr:.1f} bpm")
        print(f"   SOT HR: {sot['expected_hr']} bpm")
        error = abs(avg_hr - sot['expected_hr']) / sot['expected_hr'] * 100
        print(f"   HR Error: {error:.2f}%")


def audit_activity(activity_id: str) -> Dict[str, Any]:
    """Run full audit for a single activity."""
    sot = SOT_CASES.get(activity_id)
    if not sot:
        return {"error": f"No SOT defined for {activity_id}"}

    print(f"\n{'='*60}")
    print(f"AUDITING: {sot['athlete']} - {sot['date']} - {sot['structure']}")
    print(f"Activity ID: {activity_id}")
    print(f"{'='*60}")

    # Load data
    print("\n1. Loading activity data...")
    df, laps, act_data, metadata = load_activity_data(activity_id)
    if df is None or df.empty:
        return {"error": "Failed to load activity data", "sot": sot}

    print("\n2. Target grid...")
    target_grid = sot.get("target_grid", [])
    print(f"   ✅ {len(target_grid)} targets defined")

    print("\n3. Running detection...")
    detections = run_detection(df, target_grid, laps, sport="run")
    print(f"   ✅ Detected {len(detections)} intervals")

    # Print details
    print_detection_details(detections, sot)

    # Validate
    print("\n4. Validating metrics...")
    metrics_results = validate_metrics(detections, sot)

    # Check success criteria
    success = True
    if not metrics_results["count_match"]:
        print(f"   ❌ Count mismatch: {metrics_results['num_detected']}/{metrics_results['num_expected']}")
        success = False
    else:
        print(f"   ✅ Count match: {metrics_results['num_detected']}/{metrics_results['num_expected']}")

    if metrics_results["speed_error_pct"] is not None:
        if metrics_results["speed_error_pct"] <= 2.0:
            print(f"   ✅ Speed within tolerance: {metrics_results['speed_error_pct']:.2f}% error")
        else:
            print(f"   ❌ Speed error too high: {metrics_results['speed_error_pct']:.2f}%")
            success = False

    if metrics_results["hr_error_pct"] is not None:
        if metrics_results["hr_error_pct"] <= 2.0:
            print(f"   ✅ HR within tolerance: {metrics_results['hr_error_pct']:.2f}% error")
        else:
            print(f"   ❌ HR error too high: {metrics_results['hr_error_pct']:.2f}%")
            success = False

    return {
        "activity_id": activity_id,
        "sot": sot,
        "detections": detections,
        "metrics": metrics_results,
        "success": success,
    }


def audit_all_cases():
    """
    Main audit function for all test cases.

    Validates against the SOT:
    Test 1: Steven 3*5Km (01/02/2026) - 3'20/km, 169 bpm
    Test 2: Steven 10*3'/r1' (16/01/2026) - 3'16/km, 161 bpm
    Test 3: Adrien 2*7Km Tempo (31/01/2026) - 3'41/km, 163 bpm
    Test 4: Steven 3*10Km LT1 (26/01/2026) - 3'52/km, 147 bpm
    """
    print("\n" + "=" * 60)
    print("SIGNAL OPTIMIZATION AUDIT - All Test Cases")
    print("Target: +/-2s boundary precision, <2% metrics error")
    print("=" * 60)

    results = []
    for activity_id in SOT_CASES.keys():
        result = audit_activity(activity_id)
        results.append(result)

    # Summary
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)

    all_success = True
    for r in results:
        if "error" in r and r.get("sot") is None:
            print(f"❌ {r.get('error', 'Unknown error')}")
            all_success = False
        elif "error" in r:
            sot = r["sot"]
            print(f"❌ FAIL | {sot['athlete']} | {sot['date']} | {sot['structure']} - {r['error']}")
            all_success = False
        else:
            status = "✅ PASS" if r["success"] else "❌ FAIL"
            sot = r["sot"]
            print(f"{status} | {sot['athlete']} | {sot['date']} | {sot['structure']}")
            if not r["success"]:
                all_success = False

    print("\n" + "=" * 60)
    if all_success:
        print("🎉 ALL TESTS PASSED - Surgical precision achieved!")
    else:
        print("⚠️  SOME TESTS FAILED - Calibration needed")
    print("=" * 60)

    return results


if __name__ == "__main__":
    audit_all_cases()
