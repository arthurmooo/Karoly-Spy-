
import os
import sys
import glob
import pandas as pd

# Add current directory to path so projectk_core is found
sys.path.append(os.getcwd())

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

def format_pace(speed_ms):
    if not speed_ms or speed_ms == 0:
        return "-"
    sec_per_km = 1000 / speed_ms
    minutes = int(sec_per_km // 60)
    seconds = int(sec_per_km % 60)
    return f"{minutes}:{seconds:02d}/km"

def run_report():
    data_dir = "data/test_cache"
    files = sorted(glob.glob(os.path.join(data_dir, "*.fit")))
    matcher = IntervalMatcher()
    
    print(f"Running Interval Matcher V3 on {len(files)} files...\n")
    
    for fpath in files:
        fname = os.path.basename(fpath)
        # Skip if corresponding json doesn't exist (needed for target grid)
        json_path = fpath.replace(".fit", ".json")
        if not os.path.exists(json_path):
            continue
            
        print(f"==================================================")
        print(f"📂 {fname}")
        
        try:
            # 1. Parse Data
            try:
                df, meta, laps = FitParser.parse(fpath)
            except Exception as e:
                print(f"⚠️ Failed to parse FIT: {e}")
                continue
            
            # 2. Parse Plan
            with open(json_path, 'r') as f:
                import json
                plan_data = json.load(f)
            
            # 3. Match
            sport = plan_data.get('activity', {}).get('sport', 'run')
            if not isinstance(sport, str): sport = 'run'
            parser = NolioPlanParser()
            target_grid = parser.parse(plan_data.get('planned_structure', []), sport_type=sport)
            
            results = matcher.match(
                df=df,
                laps=laps,
                target_grid=target_grid,
                sport=sport
            )
            
            # 4. Format Results
            table_data = []
            for i, res in enumerate(results):
                status = res.get('status')
                if status == 'not_found':
                    table_data.append({
                        'Idx': i+1,
                        'Status': '❌ MISS',
                        'Source': '-',
                        'Durée': f"{int(res.get('target', {}).get('duration', 0))}s (Target)",
                        'Pwr': '-', 
                        'Pace': '-',
                        'FC': '-'
                    })
                    continue
                
                # Matched
                # Metrics are flat in the result dict (based on offline_validator)
                dur = (res['end_index'] - res['start_index'])  # Seconds (since 1Hz)
                pwr = res.get('avg_power') or res.get('plateau_avg_power') or 0
                spd = res.get('avg_speed') or res.get('enhanced_avg_speed') or res.get('plateau_avg_speed') or 0
                hr = res.get('avg_heart_rate') or res.get('avg_hr') or 0
                
                source = res.get('source', 'Signal').upper()
                confidence = res.get('confidence') or 0
                
                # Pace
                pace_str = format_pace(spd)
                
                table_data.append({
                    'Idx': i+1,
                    'Status': '✅ OK',
                    'Source': f"{source} ({int(confidence*100)}%)",
                    'Durée': f"{int(dur//60):02d}:{int(dur%60):02d}",
                    'Pwr': f"{int(pwr)}W" if pwr else "-",
                    'Pace': pace_str,
                    'FC': f"{int(hr)} bpm" if hr else "-"
                })
            
            if not table_data:
                print("No intervals detected (or empty target grid).")
            else:
                print(pd.DataFrame(table_data).to_markdown(index=False))
                
        except Exception as e:
            print(f"⚠️ Error: {e}")
        
        print("\n")

if __name__ == "__main__":
    run_report()
