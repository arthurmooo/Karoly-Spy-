
import os
import sys
import pandas as pd
import numpy as np

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.interval_matcher import IntervalMatcher

def test_matcher_edouard():
    file_path = "./data/test_cache/Edouard_2025-04-03.fit"
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return

    print(f"📂 Loading Edouard session: {file_path}")
    df, metadata, laps = FitParser.parse(file_path)
    
    # Target Grid: 3 * 15' (900s)
    target_grid = []
    for i in range(3):
        target_grid.append({
            "duration": 900,
            "target_min": 280, # Estimated Z3 for Edouard
            "target_type": "power",
            "type": "active"
        })
    
    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport="run", laps=laps)
    
    print(f"\n✅ MATCHING RESULTS (Hybrid):")
    for r in results:
        status = r['status']
        source = r['source']
        start = r.get('start_index', '-')
        dur = r.get('duration_sec', '-')
        score = r.get('respect_score', '-')
        conf = r.get('confidence', '-')
        print(f" Target {r['target_index']+1}: {status} | Source: {source} | Start: {start} | Dur: {dur}s | Score: {score}% | Conf: {conf}")

if __name__ == "__main__":
    test_matcher_edouard()
