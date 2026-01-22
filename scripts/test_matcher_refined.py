import os
import sys
import pandas as pd
import numpy as np

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.interval_matcher import IntervalMatcher

def run_test(athlete_name, date_str, file_path, target_grid, sport="run"):
    if not os.path.exists(file_path):
        print(f"❌ File not found for {athlete_name}: {file_path}")
        return

    print(f"\n--- Testing: {athlete_name} ({date_str}) ---")
    print(f"📂 File: {file_path}")
    df, metadata, laps = FitParser.parse(file_path)
    
    matcher = IntervalMatcher()
    # FORCE SIGNAL MODE by passing laps=None to see StepDetector in action
    results = matcher.match(df, target_grid, sport=sport, laps=None)
    
    print(f"✅ MATCHING RESULTS (Signal-Only Detection):")
    matched_count = 0
    for r in results:
        status = r['status']
        if status == 'matched': matched_count += 1
        source = r['source']
        start = r.get('start_index', '-')
        dur = r.get('duration_sec', '-')
        score = r.get('respect_score', '-')
        conf = r.get('confidence', '-')
        print(f" Target {r['target_index']+1}: {status} | Source: {source} | Start: {start} | Dur: {dur}s | Respect: {score:.1f}% | Conf: {conf}")
    
    print(f"📈 Summary: {matched_count}/{len(target_grid)} targets identified.")

if __name__ == "__main__":
    # 1. ALEXIS: 5 * 5' (300s) - Road/Path
    alexis_grid = []
    for i in range(5):
        alexis_grid.append({"duration": 300, "target_min": 4.5, "target_type": "pace", "type": "active"})
    
    run_test("Bernard Alexis", "2025-10-17", "./data/test_cache/Alexis_2025-10-17.fit", alexis_grid)

    # 2. EDOUARD: 3 * 15' (900s) - Trail (Noisy Power)
    edouard_grid = []
    for i in range(3):
        edouard_grid.append({"duration": 900, "target_min": 280, "target_type": "power", "type": "active"})
    
    run_test("Edouard Tiret", "2025-04-03", "./data/test_cache/Edouard_2025-04-03.fit", edouard_grid)