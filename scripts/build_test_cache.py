import os
import sys
import json
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from projectk_core.integrations.nolio import NolioClient

CACHE_DIR = "data/test_cache"

# List from Backlog
TARGETS = [
    {"athlete": "Adrien Claeyssen", "date": "2026-01-07", "desc": "10x2' Z3"},
    {"athlete": "Baptiste Delmas", "date": "2025-12-07", "desc": "2x(20x10-50)"},
    {"athlete": "Baptiste Delmas", "date": "2025-12-14", "desc": "3x4km"},
    {"athlete": "Baptiste Delmas", "date": "2025-12-31", "desc": "HIT Mixed"},
    {"athlete": "Baptiste Delmas", "date": "2026-01-10", "desc": "5x(12x30/15)"},
    {"athlete": "Dries Matthys", "date": "2026-01-11", "desc": "2x50' LT1"},
    {"athlete": "Cyril Neirynck", "date": "2025-08-11", "desc": "30x30 + 60'"},
    {"athlete": "Cyril Neirynck", "date": "2025-08-17", "desc": "35km Waves"},
    {"athlete": "Cyril Neirynck", "date": "2025-10-12", "desc": "4x20' Prog"},
    {"athlete": "Baptiste Delmas", "date": "2026-01-08", "desc": "5x1'30+3'30"},
    {"athlete": "Baptiste Delmas", "date": "2026-01-09", "desc": "10x1' + 5x2'"},
    {"athlete": "Bernard Alexis", "date": "2025-10-17", "desc": "5x(1'30+3'30)"},
    {"athlete": "Hadrien Tabou", "date": "2025-10-07", "desc": "Test 5'"},
]

def build_cache():
    nolio = NolioClient()
    
    # 1. Get Athletes Map
    print("🔍 Fetching Athletes List...")
    try:
        all_athletes = nolio.get_managed_athletes()
        athlete_map = {a['name']: a.get('nolio_id', a.get('id')) for a in all_athletes}
    except Exception as e:
        print(f"❌ Failed to fetch athletes: {e}")
        return

    # 2. Process Targets
    for target in TARGETS:
        name = target["athlete"]
        date = target["date"]
        desc = target["desc"]
        
        # Unique ID for cache file: "Firstname_Date"
        safe_name = name.split(' ')[0]
        cache_key = f"{safe_name}_{date}"
        json_path = os.path.join(CACHE_DIR, f"{cache_key}.json")
        fit_path = os.path.join(CACHE_DIR, f"{cache_key}.fit")
        
        if os.path.exists(json_path) and os.path.exists(fit_path):
            print(f"✅ [SKIP] Already cached: {cache_key}")
            continue
            
        print(f"📥 Processing {cache_key} ({desc})...")
        
        aid = athlete_map.get(name)
        if not aid:
            print(f"   ⚠️ Athlete {name} not found")
            continue
            
        # A. Fetch Activity
        try:
            acts = nolio.get_activities(aid, date, date)
            if not acts:
                print(f"   ⚠️ No activity found on {date}")
                continue
            
            act = acts[0] # Take main
            
            # B. Fetch Plan (Try direct link then fallback)
            plan_struct = []
            planned_id = act.get('planned_id')
            
            if planned_id:
                p = nolio.get_planned_workout(planned_id)
                if p: plan_struct = p.get('structured_workout', [])
            
            if not plan_struct:
                # Fallback search
                p = nolio.find_planned_workout(aid, date, act.get('name'))
                if p: plan_struct = p.get('structured_workout', [])
            
            # C. Save Metadata + Plan to JSON
            meta_payload = {
                "activity": act,
                "planned_structure": plan_struct,
                "target_desc": desc
            }
            with open(json_path, 'w') as f:
                json.dump(meta_payload, f, indent=2)
                
            # D. Download FIT
            file_url = act.get('file_url')
            if file_url:
                fit_data = nolio.download_fit_file(file_url)
                if fit_data:
                    with open(fit_path, 'wb') as f:
                        f.write(fit_data)
                    print(f"   ✨ Saved .fit and .json")
                else:
                    print("   ⚠️ Download failed")
            else:
                print("   ⚠️ No FIT file URL")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    build_cache()
