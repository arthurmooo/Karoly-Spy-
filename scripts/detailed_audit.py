import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

CACHE_DIR = "data/test_cache"

def detailed_audit(case_name):
    print(f"\n🔍 PRECISION AUDIT: {case_name}")
    json_path = os.path.join(CACHE_DIR, f"{case_name}.json")
    fit_path = os.path.join(CACHE_DIR, f"{case_name}.fit")
    with open(json_path, 'r') as f: data = json.load(f)
    
    plan_parser = NolioPlanParser()
    matcher = IntervalMatcher()
    
    sport = data['activity'].get('sport', 'Run')
    target_grid = plan_parser.parse(data['planned_structure'], sport_type=sport)
    df, _, _ = FitParser.parse(fit_path)
    
    start_time_activity = pd.to_datetime(data['activity'].get('hour_start', '00:00:00'))
    
    detected_sport = 'bike' if 'bike' in sport.lower() or 'vélo' in sport.lower() else 'run'
    matches = matcher.match(df, target_grid, sport=detected_sport)
    
    print(f"Plan: {len(target_grid)} targets | Found: {len(matches)}")
    print(f"{ '#':<3} | {'Time':<8} | {'Label':<15} | {'Dur':<4} | {'Target':<10} | {'Realized':<10} | {'Gap'}")
    print("-" * 85)
    
    last_end = 0
    for i, m in enumerate(matches):
        t = m['target']
        t_label = (t.get('name') or t.get('type'))[:15]
        t_val = f"{t.get('target_min', 0):.1f}"
        
        real_val = m['avg_speed'] if detected_sport == 'run' else m['avg_power']
        
        # Calculate clock time
        if m['start_index'] is not None:
            match_time = (start_time_activity + timedelta(seconds=m['start_index'])).strftime("%H:%M:%S")
        else:
            match_time = "NOT_FOUND"
        
        gap = ""
        if m['start_index'] is not None and last_end > 0:
            gap_sec = m['start_index'] - last_end
            gap = f"{int(gap_sec)}s"
            
        real_str = "N/A"
        if real_val is not None and real_val > 0:
            real_str = f"{real_val:.2f}m/s"
            if detected_sport == 'run':
                p_dec = 1000.0 / real_val / 60.0
                real_str = f"{int(p_dec)}:{int((p_dec-int(p_dec))*60):02d}/km"

        dur_str = f"{m['duration_sec']}s" if m['duration_sec'] is not None else "0s"
        print(f"{i+1:<3} | {match_time:<8} | {t_label:<15} | {dur_str:>4} | {t_val:<10} | {real_str:<10} | {gap}")
        if m['end_index'] is not None:
            last_end = m['end_index']

if __name__ == "__main__":
    if len(sys.argv) > 1:
        detailed_audit(sys.argv[1])
    else:
        detailed_audit("Baptiste_2026-01-09")
