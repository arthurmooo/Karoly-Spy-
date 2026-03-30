#!/usr/bin/env python3
"""Debug Hadrien's 20*500m session - why only 1/20 detected?"""
import tempfile
from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import TextPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

db = DBConnector()
storage = StorageManager()

# Find Hadrien's NULL 20*500m session
acts = db.client.table('activities')\
    .select('id, athlete_id, activity_name, fit_file_path, sport_type, interval_power_mean')\
    .ilike('activity_name', '%20*500m Z2%')\
    .is_('interval_power_mean', 'null')\
    .execute().data

print(f"Found {len(acts)} NULL activities with 20*500m")

for act in acts:
    athlete = db.client.table('athletes').select('first_name, last_name').eq('id', act['athlete_id']).execute().data[0]
    name = f"{athlete['first_name']} {athlete['last_name']}"

    if 'Hadrien' not in name:
        continue

    print(f"\n{'='*70}")
    print(f"🔍 {name} - {act['activity_name']}")
    print(f"{'='*70}")

    # Download and parse FIT
    fit_data = storage.download_fit_file(act['fit_file_path'])
    if not fit_data:
        print("❌ No FIT file")
        continue

    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name

    df, device_meta, laps = UniversalParser.parse(tmp_path)

    print(f"\n📊 Data Overview:")
    print(f"  - Stream length: {len(df)} seconds")
    print(f"  - LAPs found: {len(laps) if laps else 0}")

    # Parse plan
    parser = TextPlanParser()
    plan = parser.parse(act['activity_name'])
    print(f"\n📋 Parsed Plan: {len(plan)} intervals expected")
    if plan:
        print(f"  - Target: {plan[0]}")

    # Show LAPs
    if laps:
        print(f"\n🏃 LAP Details:")
        for i, lap in enumerate(laps[:25]):  # First 25 LAPs
            dur = lap.get('duration', 0)
            dist = lap.get('total_distance', 0)
            hr = lap.get('avg_hr', 0)
            spd = lap.get('avg_speed', 0)

            # Calculate pace
            pace_str = ""
            if spd and spd > 0:
                pace_s = 1000 / spd
                pace_min = int(pace_s // 60)
                pace_sec = int(pace_s % 60)
                pace_str = f"{pace_min}'{pace_sec:02d}''/km"

            print(f"  LAP {i+1:2d}: {dur:4.0f}s | {dist:5.0f}m | HR={hr:5.1f} | {pace_str}")

    # Try matching
    print(f"\n🔄 Running IntervalMatcher...")
    matcher = IntervalMatcher()
    results = matcher.match(df, plan, sport='run', laps=laps)

    matched = [r for r in results if r.get('status') == 'matched']
    print(f"  - Matched: {len(matched)}/{len(plan)}")

    if matched:
        print(f"\n✅ Matched intervals:")
        for m in matched[:5]:
            print(f"  - {m.get('source')}: idx={m.get('start_index')} dur={m.get('duration_sec')}s")

    # Check why others failed
    if len(matched) < len(plan):
        print(f"\n❌ Why did {len(plan) - len(matched)} intervals fail?")

        # Check if LAPs match 500m distance
        if laps:
            valid_500m_laps = [l for l in laps if 400 <= l.get('total_distance', 0) <= 600]
            print(f"  - LAPs with 400-600m distance: {len(valid_500m_laps)}")

            # Check duration expectations
            # 500m at ~3'30/km = ~105s
            valid_dur_laps = [l for l in laps if 80 <= l.get('duration', 0) <= 150]
            print(f"  - LAPs with 80-150s duration: {len(valid_dur_laps)}")
