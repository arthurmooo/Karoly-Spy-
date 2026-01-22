
import os
import sys
import pandas as pd
import json

# Add current directory to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

def format_pace(speed_ms):
    if not speed_ms or speed_ms <= 0: return "-"
    sec_per_km = 1000 / speed_ms
    return f"{int(sec_per_km//60)}:{int(sec_per_km%60):02d}/km"

def export_audit(athlete_name, fit_path, json_path):
    print(f"\n=== LAP AUDIT: {athlete_name} ===")
    
    # 1. Parse
    df, meta, laps = FitParser.parse(fit_path)
    with open(json_path, 'r') as f:
        plan = json.load(f)
    
    sport = plan.get('activity', {}).get('sport', 'run')
    if not isinstance(sport, str): sport = 'run'
    
    parser = NolioPlanParser()
    target_grid = parser.parse(plan.get('planned_structure', []), sport_type=sport)
    
    # 2. Match
    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport=sport, laps=laps)
    
    # Map matched laps for easy lookup
    lap_to_match = {}
    for res in results:
        if res.get('source') == 'lap' and res.get('lap_index') is not None:
            lap_to_match[res['lap_index']] = res

    # 3. Build Table of ALL Laps
    audit_data = []
    for i, lap in enumerate(laps):
        match = lap_to_match.get(i)
        
        dur = lap.get('total_timer_time') or lap.get('total_elapsed_time', 0)
        dist = lap.get('total_distance', 0)
        pwr = lap.get('avg_power', 0)
        spd = lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)
        hr = lap.get('avg_heart_rate', 0) or lap.get('avg_hr', 0)
        
        status = "Match ✅" if match else "Unused ⚪"
        confidence = f"{int(match['confidence']*100)}%" if match else "-"
        target_idx = f"T{match['target_index']+1}" if match else "-"
        
        audit_data.append({
            'Lap': i + 1,
            'Status': status,
            'Conf': confidence,
            'Target': target_idx,
            'Duration': f"{int(dur//60):02d}:{int(dur%60):02d}",
            'Dist (m)': int(dist),
            'Power (W)': int(pwr) if pwr else "-",
            'Pace': format_pace(spd),
            'HR': int(hr) if hr else "-"
        })
    
    print(pd.DataFrame(audit_data).to_markdown(index=False))

if __name__ == "__main__":
    # Conduct audit for the 3 main athletes
    cases = [
        ("Adrien", "data/test_cache/Adrien_2026-01-07.fit", "data/test_cache/Adrien_2026-01-07.json"),
        ("Baptiste", "data/test_cache/Baptiste_2026-01-09.fit", "data/test_cache/Baptiste_2026-01-09.json")
    ]
    
    for name, f, j in cases:
        if os.path.exists(f) and os.path.exists(j):
            export_audit(name, f, j)
