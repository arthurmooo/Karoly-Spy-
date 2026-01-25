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
                
                # We need to compute avg power/speed for each GT interval from the DF 
                # because manual laps in GT might not have it, or we want consistent calculation.
                # Actually, let's use the DF to get the "Truth" intensity for the target
                
                for idx, interval in enumerate(gt_intervals):
                    start_dt = pd.to_datetime(interval['start']).tz_convert('UTC')
                    end_dt = pd.to_datetime(interval['end']).tz_convert('UTC')
                    duration = interval['duration']
                    
                    # Skip very short laps (likely button presses)
                    if duration < 10:
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
                for det in detected:
                    t_idx = det['target_index']
                    if t_idx >= len(gt_intervals): continue # Should not happen
                    
                    # Find the corresponding GT interval (simple index matching since we built grid from GT)
                    # Note: We filtered short laps in target_grid building, 
                    # so we need to map back to original GT index or just align by sequence.
                    # Simplified: We only compare matched intervals.
                    
                    # Actually, since we skipped short laps in grid, target_index 0 corresponds to 
                    # the first LONG lap in GT.
                    # Let's align carefully.
                    
                    # Re-get the specific target used
                    target_used = target_grid[t_idx]
                    
                    # Find which GT interval generated this target
                    # This is tricky without an ID. 
                    # We'll just assume sequential because match() returns in order of targets.
                    
                    # Let's get the GT interval that corresponds to this target.
                    # Since we built target_grid sequentially from gt_intervals (skipping short),
                    # we can find the matching GT by reconstructing the filtered list.
                    filtered_gt = [g for g in gt_intervals if g['duration'] >= 10]
                    
                    if t_idx < len(filtered_gt):
                        gt = filtered_gt[t_idx]
                        gt_start = pd.to_datetime(gt['start']).tz_convert('UTC')
                        gt_end = pd.to_datetime(gt['end']).tz_convert('UTC')
                        
                        det_start = df.index[det['start_index']]
                        end_idx_safe = min(det['end_index'], len(df) - 1)
                        det_end = df.index[end_idx_safe]
                        
                        start_err = abs((det_start - gt_start).total_seconds())
                        end_err = abs((det_end - gt_end).total_seconds())
                        
                        errors.append(start_err)
                        errors.append(end_err)
                
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