import os
import sys
import json
import pandas as pd
from typing import List, Dict
import traceback

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.logic.interval_detector import IntervalDetector
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.logic.models import Activity, ActivityMetadata

CACHE_DIR = "data/test_cache"

def run_offline_validation():
    print("🚀 Starting Offline Validation Bench...")
    
    plan_parser = NolioPlanParser()
    classifier = ActivityClassifier()
    detector = IntervalDetector()
    matcher = IntervalMatcher()
    
    files = [f for f in os.listdir(CACHE_DIR) if f.endswith(".json")]
    files.sort()
    
    results = []
    
    for js_file in files:
        base_name = js_file.replace(".json", "")
        fit_file = os.path.join(CACHE_DIR, base_name + ".fit")
        json_path = os.path.join(CACHE_DIR, js_file)
        
        if not os.path.exists(fit_file):
            continue
            
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        act_meta = data.get('activity', {})
        plan_struct = data.get('planned_structure', [])
        desc = data.get('target_desc', '')
        
        print(f"\n🧪 Testing: {base_name} ({desc})")
        
        try:
            # 1. Parse FIT
            df, _, _ = FitParser.parse(fit_file)
            if df.empty:
                print("   ❌ Empty FIT")
                continue
                
            # 2. Parse Plan
            sport = act_meta.get('sport', 'Run')
            target_grid = plan_parser.parse(plan_struct, sport_type=sport)
            print(f"   📋 Plan: {len(target_grid)} intervals found.")
            
            # 3. Classify
            work_type = classifier.detect_work_type(df, act_meta.get('name', ''), act_meta.get('sport', ''), target_grid=target_grid)
            print(f"   🏷️ Type: {work_type}")
            
            # 4. Detect
            found = 0
            s_low = act_meta.get('sport', '').lower()
            detected_sport = 'bike' if 'bike' in s_low or 'vélo' in s_low or 'cyclisme' in s_low else ('swim' if 'swim' in s_low or 'natation' in s_low else 'run')
            
            if work_type == "intervals" or work_type == "competition":
                if target_grid:
                    print(f"   🔎 Strategy: Surgical Matcher (Plan Driven) - Sport: {detected_sport}")
                    matches = matcher.match(df, target_grid, sport=detected_sport)
                    found = len(matches)
                    
                    # Debug: Print matches summary
                    # for m in matches:
                    #     print(f"      - Found {m['duration_sec']}s @ {m.get('avg_power', m.get('avg_speed')):.1f}")
                else:
                    print("   🔎 Strategy: Blind Detector (Signal Driven)")
                    # Construct Fake Activity for Detector
                    meta = ActivityMetadata(
                        activity_type=act_meta.get('sport', 'Bike'),
                        start_time=pd.Timestamp.now(), 
                        duration_sec=len(df),
                        work_type=work_type
                    )
                    activity = Activity(metadata=meta, streams=df)
                    detection_res = detector.detect(activity)
                    found = len(detection_res.get('blocks', []))
            
            print(f"   ✅ Found: {found}")
            
            # Status Logic
            status = "✅ MATCH" if len(target_grid) == found else "❌ FAIL"
            if len(target_grid) == 0 and found > 0: status = "⚠️ BLIND OK"
            
            if status == "❌ FAIL" and target_grid:
                print(f"   ❌ DEBUG FAIL: {base_name}")
                t0 = target_grid[0]
                print(f"      Target[0]: {t0}")
                
                # Check columns
                print(f"      Columns: {list(df.columns)}")
                
                # Check signal max
                signal_col = 'power' if 'power' in df.columns else 'speed'
                if signal_col in df.columns:
                    sig = df[signal_col].fillna(0)
                    roll = sig.rolling(int(t0['duration'])).mean()
                    print(f"      Signal ({signal_col}) Max 95%: {roll.quantile(0.95):.1f}, Max: {roll.max():.1f}")
            
            results.append({
                "Test": base_name,
                "Plan": len(target_grid),
                "Found": found,
                "Status": status
            })
            
        except Exception as e:
            print(f"   💥 Error: {e}")
            traceback.print_exc()

    # Summary
    print("\n=== SUMMARY ===")
    df_res = pd.DataFrame(results)
    print(df_res.to_string())

if __name__ == "__main__":
    run_offline_validation()
