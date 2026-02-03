
import os
import sys
import tempfile
import pandas as pd
from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.logic.models import Activity, ActivityMetadata

def surgical_audit(activity_id):
    db = DBConnector()
    storage = StorageManager()
    matcher = IntervalMatcher()
    
    # 1. Get Metadata
    res = db.client.table("activities").select("*").eq("id", activity_id).execute()
    act_data = res.data[0]
    
    # 2. Get Plan
    # Since we know it's 20x1'30, let's mock the grid for perfect comparison
    target_grid = []
    for _ in range(20):
        target_grid.append({"type": "active", "duration": 90, "target_min": 3.5})
        target_grid.append({"type": "recovery", "duration": 45, "target_min": 2.5})

    # 3. Download and Parse
    content = storage.download_fit_file(act_data['fit_file_path'])
    with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    df, _, laps = UniversalParser.parse(tmp_path)
    os.unlink(tmp_path)
    
    # 4. Run Matcher
    detections = matcher.match(df, target_grid, sport="run", laps=laps)
    
    print(f"\n=== SURGICAL AUDIT: {act_data['activity_name']} ===")
    print(f"Total matched: {len(detections)}/20 planned work intervals\n")
    
    # Table header
    print(f"{ 'Int #':<6} | {'Source':<8} | {'Dur (s)':<8} | {'Pace (FIT)':<10} | {'Pace (CALC)':<10} | {'HR (FIT)':<8} | {'HR (CALC)':<8} | {'Status'}")
    print("-" * 90)
    
    for i, d in enumerate(detections):
        if d['target'].get('type') != 'active': continue
        
        # Ground truth from the matched LAP
        lap_idx = d['lap_index']
        # p_lap comes from matcher preprocessing
        p_laps = matcher._preprocess_laps([laps[lap_idx]], "speed")
        p_lap = p_laps[0]
        
        fit_s = p_lap['avg_speed']
        fit_hr = p_lap['avg_hr']
        
        calc_s = d['avg_speed']
        calc_hr = d['avg_hr']
        
        def s_to_p(s):
            m = 1000/s/60
            return f"{int(m)}'{int((m%1)*60):02d}"
            
        status = "✅ PERFECT" if abs(calc_s - fit_s) < 0.05 and abs(calc_hr - fit_hr) < 0.5 else "❌ DIFF"
        
        print(f"{i+1:<6} | {d['source'].upper():<8} | {d['duration_sec']:<8} | {s_to_p(fit_s):<10} | {s_to_p(calc_s):<10} | {fit_hr:<8.1f} | {calc_hr:<8.1f} | {status}")

if __name__ == "__main__":
    surgical_audit("2b0b7874-ed99-4e42-b4a4-486595d6a504")
