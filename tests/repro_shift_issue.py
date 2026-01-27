import sys
import os
import json
import pandas as pd
import numpy as np

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

def test_repro_shift():
    # 1. Load Data
    athlete_name = "Louis_Richard"
    date_str = "2026-01-27"
    session_name = "7_2Km_Z2__r_500m"
    
    base_path = f"data/samples/debug_{athlete_name}_{date_str}_{session_name}"
    json_path = f"{base_path}.json"
    fit_path = f"{base_path}.fit"
    
    if not os.path.exists(json_path) or not os.path.exists(fit_path):
        print(f"❌ Missing debug files: {base_path}")
        return

    print(f"📥 Loading session: {session_name}")
    
    # 2. Parse Plan
    with open(json_path, 'r') as f:
        details = json.load(f)
    
    structure = details.get('structured_workout')
    
    if structure:
        print("✅ Found structured_workout")
        parser = NolioPlanParser()
        target_grid = parser.parse(structure, sport_type="run")
    else:
        print("⚠️ No structured_workout, falling back to TextPlanParser on name")
        from projectk_core.processing.plan_parser import TextPlanParser
        text_parser = TextPlanParser()
        # Use planned_name if available, else name
        p_name = details.get('planned_name') or details.get('name')
        target_grid = text_parser.parse(p_name)

    if not target_grid:
        print("❌ Could not parse plan from structure or name")
        return

    print(f"✅ Plan Parsed: {len(target_grid)} work intervals")
    
    # Print plan summary
    for i, t in enumerate(target_grid):
        print(f"  Target {i+1}: {t.get('duration')}s (or {t.get('distance_m')}m) @ {t.get('target_min')}-{t.get('target_max')} {t.get('target_type')}")

    # 3. Parse FIT
    df, meta, laps = UniversalParser.parse(fit_path)
    print(f"✅ FIT Parsed: {len(df)} rows, {len(laps)} laps")
    
    print("\n--- FIT LAPS ---")
    for i, l in enumerate(laps):
        print(f"  Lap {i}: Dur={l.get('total_elapsed_time')}s, Dist={l.get('total_distance')}m, Pwr={l.get('avg_power')}W, Spd={l.get('avg_speed')}m/s")
    
    # 4. Run Matcher
    matcher = IntervalMatcher()
    intervals = matcher.match(df, target_grid, sport="run", laps=laps)
    
    print(f"\n🏃‍♂️ Matcher Found: {len(intervals)} intervals")
    
    # 5. Analyze Results
    mixed_sources = False
    shift_count = 0
    lap_count = 0
    
    print("\n--- Interval Source Analysis ---")
    for i, iv in enumerate(intervals):
        source = iv.get('source')
        conf = iv.get('confidence', 0)
        print(f"  Interval {i+1}: {source.upper()} (Conf: {conf:.2f}) - {iv.get('duration_sec')}s vs Target {iv.get('expected_duration')}s")
        
        if source == 'signal':
            shift_count += 1
        elif source == 'lap':
            lap_count += 1
            
    if shift_count > 0 and lap_count > 0:
        mixed_sources = True
        print("\n⚠️  MIXED MODE DETECTED")
    elif shift_count == len(intervals):
        print("\n⚠️  ALL SIGNAL MODE")
    elif lap_count == len(intervals):
        print("\n✅ ALL LAP MODE (Ideal)")
        
    # 6. Assertions for Repro
    # We expect the bug to cause shifts to signal, especially in later intervals.
    # The 7th interval is the specific case mentioned.
    if len(intervals) >= 7:
        last_iv = intervals[6] # 7th
        print(f"\n🔍 7th Interval Source: {last_iv.get('source')}")
        
        if last_iv.get('source') == 'signal':
            print("🐞 BUG REPRODUCED: 7th interval shifted to Signal.")
            # Standard: if we are reproducing a bug, we exit with 0 (success in reproduction) 
            # OR we exit with 1 to indicate "Test Failed" (which is what we want for CI to say 'fix this').
            # Since this is a dev script, I'll print REPRODUCED and exit 1 so I know it needs fixing.
            sys.exit(1)
        else:
            print("✅ 7th interval used Laps. Bug not reproduced (or flaky).")
            sys.exit(0)
    else:
        print("❌ Fewer than 7 intervals found.")
        sys.exit(1)

if __name__ == "__main__":
    test_repro_shift()
