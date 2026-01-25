import sys
import os
import json
import time
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from datetime import datetime, timedelta

# Add project root
sys.path.append(os.getcwd())

from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.interval_matcher import IntervalMatcher, MatchConfig

# CONFIGURATION
CACHE_DIR = "data/test_cache"
SOT_FILE = os.path.join(CACHE_DIR, "sot_ground_truth.json")

# Selected Sessions
ATHLETE_ID = 57896
SESSIONS = {
    "SESSION_A": 88478697, # 10x2' Z3
    "SESSION_B": 88456295, # 30/30 VMA
    "SESSION_C": 88549362  # Tapis (Likely Steady/Mixed)
}

class BenchmarkMatcher:
    def __init__(self):
        self.client = NolioClient()
        self.ground_truth = {}
        self.ensure_cache_dir()

    def ensure_cache_dir(self):
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)

    def get_fit_path(self, activity_id: int) -> str:
        return os.path.join(CACHE_DIR, f"{activity_id}.fit")

    def fetch_and_cache(self):
        print("--- Fetching & Caching Sessions ---")
        for label, aid in SESSIONS.items():
            path = self.get_fit_path(aid)
            if os.path.exists(path):
                print(f"[{label}] {aid} already cached.")
                continue
            
            print(f"[{label}] Downloading {aid}...")
            # 1. Get Details for URL
            details = self.client.get_activity_details(aid, athlete_id=ATHLETE_ID)
            if not details:
                print(f"❌ Could not get details for {aid}")
                continue
            
            file_url = details.get('file_url')
            if not file_url:
                print(f"❌ No file URL for {aid}")
                continue
            
            # 2. Download
            content = self.client.download_fit_file(file_url)
            if content:
                with open(path, 'wb') as f:
                    f.write(content)
                print(f"✅ Saved to {path}")
            else:
                print(f"❌ Download failed for {aid}")
            
            # Rate limit safety
            time.sleep(1)

    def generate_ground_truth_from_laps(self):
        print("\n--- Generating Ground Truth from Manual Laps ---")
        gt_data = {}
        
        for label, aid in SESSIONS.items():
            path = self.get_fit_path(aid)
            if not os.path.exists(path):
                print(f"⚠️ File missing for {label}, skipping GT generation.")
                continue
                
            try:
                df, meta, laps = UniversalParser.parse(path)
                if not laps:
                    print(f"⚠️ No laps found for {label} ({aid}).")
                    continue
                
                # Convert laps to list of dicts with ISO timestamps
                # We assume manual laps ARE the truth for now.
                true_intervals = []
                for lap in laps:
                    # Calculate End Time if not present (usually not in manual laps)
                    start_dt = lap.get('start_time')
                    duration = lap.get('total_timer_time')
                    
                    if not start_dt or duration is None:
                        continue
                        
                    end_dt = start_dt + timedelta(seconds=duration)
                    
                    true_intervals.append({
                        "start": start_dt.isoformat(),
                        "end": end_dt.isoformat(),
                        "duration": duration,
                        "label": "manual_lap" # Placeholder
                    })
                
                gt_data[str(aid)] = {
                    "label": label,
                    "intervals": true_intervals
                }
                print(f"✅ {label}: Extracted {len(true_intervals)} laps.")
                
            except Exception as e:
                print(f"❌ Error parsing {label}: {e}")

        with open(SOT_FILE, 'w') as f:
            json.dump(gt_data, f, indent=2)
        print(f"💾 Saved Ground Truth to {SOT_FILE}")
        self.ground_truth = gt_data

    def load_ground_truth(self):
        if os.path.exists(SOT_FILE):
            with open(SOT_FILE, 'r') as f:
                self.ground_truth = json.load(f)
        else:
            self.generate_ground_truth_from_laps()

    def run_benchmark(self):
        print("\n--- Running Benchmark (Baseline) ---")
        
        matcher = IntervalMatcher(MatchConfig())
        results = {}
        
        for aid_str, data in self.ground_truth.items():
            label = data['label']
            path = self.get_fit_path(int(aid_str))
            
            if not os.path.exists(path):
                continue
                
            try:
                # 1. Parse DF
                df, meta, laps_raw = UniversalParser.parse(path)
                if 'timestamp' in df.columns:
                    df = df.set_index('timestamp')
                
                # 2. Build Target Grid from GT Intervals
                # We pretend the Manual Laps are the Plan
                target_grid = []
                gt_intervals = data['intervals']
                
                # Sort by start time just in case
                gt_intervals.sort(key=lambda x: x['start'])
                
                last_end_time = None
                
                for idx, interval in enumerate(gt_intervals):
                    start_dt = pd.to_datetime(interval['start']).tz_convert('UTC')
                    end_dt = pd.to_datetime(interval['end']).tz_convert('UTC')
                    duration = interval['duration']
                    
                    # Check for gap from previous
                    if last_end_time is not None:
                        gap = (start_dt - last_end_time).total_seconds()
                        if gap > 5:
                            # Insert Rest Target
                            target_grid.append({
                                "duration": gap,
                                "target_min": 0, # Rest
                                "target_type": "power",
                                "type": "recovery"
                            })
                    
                    last_end_time = end_dt
                    
                    # Skip very short laps (likely button presses)
                    # BUT keep them if we want perfect sync? 
                    # If we skip them, we lose time.
                    # Let's keep them as "transitions" or "rests"
                    if duration < 10:
                         target_grid.append({
                            "duration": duration,
                            "target_min": 0,
                            "target_type": "power",
                            "type": "recovery" # Treat as rest
                        })
                         continue
                        
                    # Calculate avg intensity from DF to set as target_min
                    # Find indices in DF
                    # DF index is timestamp
                    mask = (df.index >= start_dt) & (df.index <= end_dt)
                    segment = df[mask]
                    
                    target_min = 0
                    if not segment.empty:
                        if 'power' in df.columns:
                            target_min = segment['power'].mean()
                            target_type = 'power'
                        else:
                            target_min = segment['speed'].mean()
                            target_type = 'speed'
                    else:
                        target_type = 'power' # Default
                        
                    target_grid.append({
                        "duration": duration,
                        "target_min": target_min,
                        "target_type": target_type,
                        "type": "active" # Assumption
                    })

                # 3. Run Matcher (Signal Only - pass laps=None)
                # We want to test the SIGNAL engine, so we hide the laps from the matcher.
                detected = matcher.match(
                    df=df,
                    target_grid=target_grid,
                    sport="run", # Assuming Run for now, can be dynamic
                    laps=None # Force signal detection
                )
                
                # 4. Compare & Calculate RMSE
                errors = []
                print(f"\n[DEBUG] Detailed results for {label}:")
                
                # We need to map Detected Targets back to GT Intervals.
                # Since we inserted gaps, target_grid is now: [Lap1, Gap, Lap2, Lap3...]
                # detected matches target_grid indices.
                
                gt_cursor = 0 # Index in gt_intervals
                # But wait, target_grid has MORE items than gt_intervals (due to gaps).
                # We need to map target_index -> gt_index.
                
                target_to_gt = {}
                tg_idx = 0
                last_end = None
                
                # Reconstruct the mapping
                for idx, interval in enumerate(gt_intervals):
                    start_dt = pd.to_datetime(interval['start']).tz_convert('UTC')
                    
                    # Did we insert a gap?
                    if last_end is not None:
                        gap = (start_dt - last_end).total_seconds()
                        if gap > 5:
                            tg_idx += 1 # Skip the inserted gap target
                    
                    last_end = pd.to_datetime(interval['end']).tz_convert('UTC')
                    
                    # Now tg_idx corresponds to this interval (even if short)
                    # Because we included short laps in grid too
                    target_to_gt[tg_idx] = idx
                    tg_idx += 1
                
                for det in detected:
                    t_idx = det['target_index']
                    
                    if t_idx in target_to_gt:
                        gt_idx = target_to_gt[t_idx]
                        gt = gt_intervals[gt_idx]
                        gt_start = pd.to_datetime(gt['start']).tz_convert('UTC')
                        
                        det_start = df.index[det['start_index']]
                        
                        start_err = (det_start - gt_start).total_seconds()
                        errors.append(abs(start_err))
                        
                        if len(errors) < 5 or abs(start_err) > 60:
                             pass # print(f"  T{t_idx} (GT{gt_idx}): Err={start_err:.1f}s | GT={gt_start.strftime('%H:%M:%S')} vs Det={det_start.strftime('%H:%M:%S')}")
                
                rmse = np.sqrt(np.mean(np.square(errors))) if errors else 0
                
                results[label] = {
                    "rmse": rmse,
                    "count": len(detected),
                    "total_targets": len(target_grid)
                }
                print(f"✅ {label}: RMSE = {rmse:.2f}s ({len(detected)}/{len(target_grid)} matched)")
                
            except Exception as e:
                print(f"❌ Error benchmarking {label}: {e}")
                import traceback
                traceback.print_exc()

        return results

if __name__ == "__main__":
    bm = BenchmarkMatcher()
    bm.fetch_and_cache()
    bm.load_ground_truth()
    bm.run_benchmark()