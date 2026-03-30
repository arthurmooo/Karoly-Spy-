"""
Diagnostic script for Feb 5 pace precision issues.
Runs the FIXED pipeline locally (no DB writes) and compares to SOT.

For each session:
1. Downloads FIT, parses it
2. Runs IntervalMatcher.match() (with Fix 1: LAP-native speed)
3. Computes Amoy/Alast exactly like calculator.py (with Fix 2: distance-weighted)
4. Also computes old-method values for comparison
5. Prints results vs SOT
"""
import os
import tempfile
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import TextPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher


TARGETS = [
    {
        "athlete": "Margot Sellem",
        "first_name": "Margot",
        "activity_pattern": "8%1Km",
        "session_date": "2026-02-05",
        "sot_amoy": 4 * 60 + 37,   # 4'37 = 277s
        "sot_alast": 4 * 60 + 36,  # 4'36 = 276s
    },
    {
        "athlete": "Adrien Patras",
        "first_name": "Adrien",
        "activity_pattern": "20%500m Z2%150m",
        "session_date": "2026-02-04",
        "sot_amoy": 3 * 60 + 43,   # 3'43 = 223s
        "sot_alast": 3 * 60 + 35,  # 3'35 = 215s
    },
    {
        "athlete": "Franck Dupeu",
        "first_name": "Franck",
        "activity_pattern": "5%6%Z2%2",
        "session_date": "2026-02-05",
        "sot_amoy": 4 * 60 + 24,   # 4'24 = 264s
        "sot_alast": 4 * 60 + 15,  # 4'15 = 255s
        # Manual plan: 5x6min work + 2min rest (TextPlanParser misinterprets 6' as 6km)
        "manual_plan": [
            {"type": "active", "duration": 360, "distance_m": 0, "target_type": "time"},
            {"type": "recovery", "duration": 120},
        ] * 5,
    },
    {
        "athlete": "Christophe Rivart",
        "first_name": "Christophe",
        "activity_pattern": "8%5%Z2%1",
        "session_date": "2026-02-05",
        "sot_amoy": None,
        "sot_alast": 4 * 60 + 8,   # 4'08 = 248s
        # Manual plan: 8x5min work + 1min rest (TextPlanParser misinterprets 5' as 5km)
        "manual_plan": [
            {"type": "active", "duration": 300, "distance_m": 0, "target_type": "time"},
            {"type": "recovery", "duration": 60},
        ] * 8,
    },
]


def sec_to_pace(sec):
    """Seconds/km to mm'ss string."""
    if sec is None:
        return "N/A"
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m}'{s:02d}"


def speed_to_pace_sec(speed_ms):
    """m/s to seconds per km."""
    if not speed_ms or speed_ms <= 0:
        return None
    return 1000.0 / speed_ms


def main():
    db = DBConnector()
    storage = StorageManager()
    plan_parser = TextPlanParser()
    matcher = IntervalMatcher()

    for target in TARGETS:
        print(f"\n{'='*70}")
        print(f"  {target['athlete']}")
        print(f"{'='*70}")

        # Find athlete
        athletes = db.client.table('athletes')\
            .select('id, first_name, last_name, nolio_id')\
            .ilike('first_name', f"%{target['first_name']}%")\
            .execute().data
        if not athletes:
            print(f"  Athlete not found")
            continue
        athlete = athletes[0]

        # Find activity
        acts = db.client.table('activities')\
            .select('id, athlete_id, activity_name, fit_file_path, sport_type, session_date, '
                    'interval_pace_mean, interval_pace_last, work_type')\
            .eq('athlete_id', athlete['id'])\
            .eq('work_type', 'intervals')\
            .ilike('activity_name', f"%{target['activity_pattern']}%")\
            .execute().data
        acts = [a for a in acts
                if a.get('session_date', '').startswith(target['session_date'])
                and a.get('sport_type', '').lower() == 'run']
        if not acts:
            print(f"  Activity not found for: {target['activity_pattern']}")
            continue

        act = acts[0]
        db_amoy = act.get('interval_pace_mean')
        db_alast = act.get('interval_pace_last')
        print(f"  Activity: {act['activity_name']}")
        print(f"  DB current: Amoy={sec_to_pace(db_amoy * 60 if db_amoy else None)}  Alast={sec_to_pace(db_alast * 60 if db_alast else None)}")

        if not act.get('fit_file_path'):
            print(f"  No FIT file")
            continue

        # Download & parse FIT
        fit_data = storage.download_fit_file(act['fit_file_path'])
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name
        try:
            df, device_meta, laps = UniversalParser.parse(tmp_path)
        finally:
            os.unlink(tmp_path)

        # Parse plan (use manual_plan if provided, else TextPlanParser)
        if target.get('manual_plan'):
            plan = target['manual_plan']
            print(f"  Using MANUAL plan (TextPlanParser misinterprets this format)")
        else:
            plan = plan_parser.parse(act['activity_name'])
        if not plan:
            print(f"  Could not parse plan from: {act['activity_name']}")
            continue

        work_targets = [t for t in plan if t.get('type') == 'active']
        print(f"  Plan: {len(work_targets)} work intervals")

        # Run matcher (uses the FIXED _build_lap_result with LAP-native speed)
        results = matcher.match(df, plan, sport='run', laps=laps)
        matched = [r for r in results if r.get('status') == 'matched']
        print(f"  Matched: {len(matched)}/{len(work_targets)}")

        # Filter by respect score >= 82% (same as calculator.py)
        perf_detections = [d for d in matched
                          if d.get('respect_score') is not None and d.get('respect_score') >= 82.0]
        if not perf_detections:
            perf_detections = matched

        # Outlier filter (same as calculator.py)
        if len(perf_detections) >= 3:
            speeds_sorted = sorted([d['avg_speed'] for d in perf_detections if d.get('avg_speed') and d['avg_speed'] > 0])
            if speeds_sorted:
                med = speeds_sorted[len(speeds_sorted) // 2]
                before_count = len(perf_detections)
                perf_detections = [d for d in perf_detections if not d.get('avg_speed') or d['avg_speed'] >= med * 0.75]
                if len(perf_detections) < before_count:
                    print(f"  Outlier filter: {before_count} -> {len(perf_detections)} (median speed={med:.3f}, threshold={med*0.75:.3f})")

        print(f"  Perf detections: {len(perf_detections)}")

        # Check completion threshold (70%)
        num_planned = len(work_targets)
        num_matched = len(matched)
        completion = num_matched / num_planned if num_planned > 0 else 0
        all_laps = all(d.get('source') == 'LAP' for d in matched)
        print(f"  Completion: {num_matched}/{num_planned} = {completion:.0%} (threshold: 70%)")
        print(f"  All LAPs: {all_laps}")

        if completion < 0.70:
            print(f"  BELOW completion threshold - metrics would be NULL")

        # Print each interval
        print(f"\n  {'#':>3} | {'Source':>6} | {'avg_speed':>9} | {'Pace':>6} | {'dur':>5} | {'respect':>7}")
        print(f"  {'-'*3}-+-{'-'*6}-+-{'-'*9}-+-{'-'*6}-+-{'-'*5}-+-{'-'*7}")
        for i, d in enumerate(perf_detections):
            spd = d.get('avg_speed')
            pace = sec_to_pace(speed_to_pace_sec(spd))
            src = d.get('source', '?')
            dur = d.get('duration_sec', 0)
            resp = d.get('respect_score')
            print(f"  {i+1:>3} | {src:>6} | {spd:>9.3f} | {pace:>6} | {dur:>5} | {f'{resp:.1f}%' if resp else 'N/A':>7}")

        # Also compute stream speed for comparison (what OLD code used)
        print(f"\n  --- Stream speed comparison (old vs new) ---")
        for i, d in enumerate(perf_detections):
            s = d.get('start_index', 0)
            e = d.get('end_index', s + d.get('duration_sec', 0))
            stream_spd = float(df['speed'].iloc[s:e].dropna().mean()) if 'speed' in df.columns else None
            new_spd = d.get('avg_speed')
            stream_pace = sec_to_pace(speed_to_pace_sec(stream_spd))
            new_pace = sec_to_pace(speed_to_pace_sec(new_spd))
            delta = ""
            if stream_spd and new_spd:
                delta_sec = speed_to_pace_sec(new_spd) - speed_to_pace_sec(stream_spd)
                delta = f"{delta_sec:+.1f}s"
            print(f"  {i+1:>3} | Old(stream)={stream_pace:>6}  New(det)={new_pace:>6}  {delta}")

        # ======= Compute Amoy / Alast =======
        valid_s = [d['avg_speed'] for d in perf_detections if d.get('avg_speed')]

        if not valid_s or completion < 0.70:
            print(f"\n  Result: metrics would be NULL (insufficient match)")
            print(f"  SOT:    Amoy={sec_to_pace(target['sot_amoy'])}  Alast={sec_to_pace(target['sot_alast'])}")
            continue

        # NEW METHOD: distance-weighted pace (Fix 2)
        total_time = 0
        total_dist = 0
        for d in perf_detections:
            spd = d.get('avg_speed')
            dur = d.get('duration_sec', 0)
            if spd and spd > 0 and dur and dur > 0:
                total_time += dur
                total_dist += dur * spd
        if total_dist > 0:
            new_amoy_sec = (total_time / total_dist) * 1000
        else:
            new_amoy_sec = None

        # OLD METHOD: arithmetic mean of speeds
        old_avg_speed = sum(valid_s) / len(valid_s)
        old_amoy_sec = 1000.0 / old_avg_speed if old_avg_speed > 0 else None

        # Alast (last interval speed)
        last_spd = perf_detections[-1].get('avg_speed')
        new_alast_sec = speed_to_pace_sec(last_spd)

        # Print final comparison
        sot_amoy = target['sot_amoy']
        sot_alast = target['sot_alast']

        print(f"\n  ╔══════════════════════════════════════════════════╗")
        print(f"  ║  RESULTS COMPARISON                              ║")
        print(f"  ╠══════════════════════════════════════════════════╣")
        print(f"  ║         DB current    New (fixed)    SOT (Nolio) ║")
        amoy_db_str = sec_to_pace(db_amoy * 60 if db_amoy else None)
        amoy_new_str = sec_to_pace(new_amoy_sec)
        amoy_sot_str = sec_to_pace(sot_amoy)
        amoy_delta = f"({new_amoy_sec - sot_amoy:+.0f}s)" if new_amoy_sec and sot_amoy else ""
        print(f"  ║  Amoy:  {amoy_db_str:>8}     {amoy_new_str:>8}     {amoy_sot_str:>8} {amoy_delta:>6} ║")

        alast_db_str = sec_to_pace(db_alast * 60 if db_alast else None)
        alast_new_str = sec_to_pace(new_alast_sec)
        alast_sot_str = sec_to_pace(sot_alast)
        alast_delta = f"({new_alast_sec - sot_alast:+.0f}s)" if new_alast_sec and sot_alast else ""
        print(f"  ║  Alast: {alast_db_str:>8}     {alast_new_str:>8}     {alast_sot_str:>8} {alast_delta:>6} ║")
        print(f"  ╚══════════════════════════════════════════════════╝")

        # Also show old-method Amoy for comparison
        old_amoy_str = sec_to_pace(old_amoy_sec)
        print(f"  (Old method arith-mean Amoy would be: {old_amoy_str})")


if __name__ == "__main__":
    main()
