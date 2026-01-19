import os
import sys
import json
import pandas as pd
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

CACHE_DIR = "data/test_cache"

def detailed_audit(case_name):
    print(f"\n{'='*60}")
    print(f"🔍 DETAILED AUDIT: {case_name}")
    print(f"{'='*60}")
    
    json_path = os.path.join(CACHE_DIR, f"{case_name}.json")
    fit_path = os.path.join(CACHE_DIR, f"{case_name}.fit")
    
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    plan_parser = NolioPlanParser()
    matcher = IntervalMatcher()
    
    # 1. Parse Plan
    sport = data['activity'].get('sport', 'Run')
    target_grid = plan_parser.parse(data['planned_structure'], sport_type=sport)
    
    # 2. Parse FIT
    df, _, _ = FitParser.parse(fit_path)
    
    # 3. Match
    detected_sport = 'bike' if 'bike' in sport.lower() or 'vélo' in sport.lower() else 'run'
    matches = matcher.match(df, target_grid, sport=detected_sport)
    
    # 4. Display Results
    print(f"Plan Grid: {len(target_grid)} targets | Matches Found: {len(matches)}")
    print(f"{'#':<3} | {'Label':<20} | {'Target':<15} | {'Duration':<8} | {'Realized':<10} | {'Respect'}")
    print("-" * 85)
    
    for i, m in enumerate(matches):
        t = m['target']
        t_label = (t.get('name') or t.get('type'))[:20]
        t_val = f"{t.get('target_min', 0):.1f}-{t.get('target_max', 0):.1f}"
        
        real_val = m['avg_speed'] if detected_sport == 'run' else m['avg_power']
        unit = "m/s" if detected_sport == 'run' else "W"
        
        # Format realized
        real_str = f"{real_val:.2f} {unit}"
        
        respect = f"{m['respect_score']:.1f}%" if m['respect_score'] else "N/A"
        
        print(f"{i+1:<3} | {t_label:<20} | {t_val:<15} | {m['duration_sec']:>3}s     | {real_str:<10} | {int(m['avg_hr']):<6} | {respect}")

if __name__ == "__main__":
    # Case 1: The "Classic Reps" (Adrien)
    detailed_audit("Adrien_2026-01-07")
    
    # Case 2: The "Nested Boss" (Baptiste)
    detailed_audit("Baptiste_2026-01-09")
