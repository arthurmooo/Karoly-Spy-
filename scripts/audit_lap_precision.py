
import os
import sys
import pandas as pd
from dotenv import load_dotenv
from tabulate import tabulate

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser

def audit_session(athlete_name_partial, date_str, local_fit_path):
    client = NolioClient()
    
    # 1. Find Athlete
    print(f"🔍 Searching for athlete matching '{athlete_name_partial}'...")
    athletes = client.get_managed_athletes()
    if athletes:
        print("DEBUG: Sample Athlete Keys:", athletes[0].keys())
    
        # Try finding with generic key search or flexible naming
        athlete = None
        for a in athletes:
            # Check commonly used keys
            first = a.get('firstname') or a.get('first_name') or a.get('firstName') or ""
            last = a.get('lastname') or a.get('last_name') or a.get('lastName') or ""
            
            # Fallback to 'name'
            if 'name' in a:
                full = a['name']
            else:
                full = f"{first} {last}"
            
            if athlete_name_partial.lower() in full.lower():
                athlete = a
                break
                
        if not athlete:
            print(f"❌ Athlete not found.")
            return
        
        # Normalize ID access
        athlete_id = athlete.get('id') or athlete.get('nolio_id')
        print(f"✅ Found: {full} (ID: {athlete_id})")
        
        # 2. Find Activity on Date
        print(f"🔍 Fetching activities for {date_str}...")
        activities = client.get_activities(athlete_id, date_str, date_str)    
    if not activities:
        print(f"❌ No activities found on {date_str}.")
        return

    # Pick the first one for now (assuming single session or primary session)
    activity_summary = activities[0]
    print(f"DEBUG: Activity Keys: {activity_summary.keys()}")
    
    # Normalize Activity ID
    activity_id = activity_summary.get('id') or activity_summary.get('activityId') or activity_summary.get('nolio_id')
    
    print(f"✅ Found Activity ID: {activity_id} - {activity_summary.get('name', 'Untitled')}")
    
    # 3. Get Detailed Activity Data (hope for laps)
    # Nolio API behavior: 'laps' are often in the detailed response or sometimes computed on the fly.
    # Let's inspect what we get.
    details = client.get_activity_details(activity_id, athlete_id=athlete_id)
    
    # 4. Parse Local FIT (Download if needed)
    print(f"📂 Checking local FIT file: {local_fit_path}")
    
    file_valid = False
    if os.path.exists(local_fit_path):
        try:
            # Quick check by parsing header/start
            FitParser.parse(local_fit_path)
            file_valid = True
            print("✅ File exists and is valid.")
        except Exception as e:
            print(f"⚠️ File exists but is invalid: {e}")
            file_valid = False

    if not file_valid:
        print("📥 Downloading FIT file from Nolio...")
        file_url = activity_summary.get('file_url')
        print(f"DEBUG: file_url = {file_url}")
        
        if not file_url:
            print("❌ No file_url in activity summary. Cannot download.")
            return
            
        content = client.download_fit_file(file_url)
        if content:
            # Check for GZIP signature
            if content.startswith(b'\x1f\x8b'):
                import gzip
                print("📦 Detected GZIP content. Decompressing...")
                try:
                    content = gzip.decompress(content)
                except Exception as e:
                    print(f"❌ Decompression failed: {e}")
                    return

            with open(local_fit_path, 'wb') as f:
                f.write(content)
            print(f"✅ Downloaded and saved to {local_fit_path}")
        else:
            print("❌ Failed to download file.")
            return

    _, metadata, fit_laps = FitParser.parse(local_fit_path)
    print(f"✅ Parsed {len(fit_laps)} laps from FIT file.")
    
    # 5. Extract Nolio Laps
    # ...
    nolio_laps = details.get('laps', [])
    
    if not nolio_laps:
        print("⚠️ 'laps' key not found. Inspecting 'zones'...")
        zones = details.get('zones')
        if zones:
             print(f"DEBUG: Zones type: {type(zones)}")
             print(f"DEBUG: Zones content: {zones}")
        else:
             print("❌ 'zones' key is empty.")
             
        # Also check for 'data' or similar if hidden
        # ...

    # 6. Compare
    print("\n📊 LAP COMPARISON (FIT vs NOLIO)")
    
    # Helper to safe get
    def get_val(lap, keys, default=0):
        for k in keys:
            if k in lap and lap[k] is not None:
                return float(lap[k])
        return default

    table_data = []
    
    # We iterate based on the max number of laps found
    max_laps = max(len(fit_laps), len(nolio_laps))
    
    for i in range(max_laps):
        row = {'Lap': i + 1}
        
        # FIT Data
        if i < len(fit_laps):
            f_lap = fit_laps[i]
            row['F_Time'] = get_val(f_lap, ['total_elapsed_time', 'total_timer_time'])
            row['F_Dist'] = get_val(f_lap, ['total_distance'])
            row['F_AvgSpd'] = get_val(f_lap, ['enhanced_avg_speed', 'avg_speed'])
        else:
            row['F_Time'] = '-'
            row['F_Dist'] = '-'
            row['F_AvgSpd'] = '-'
            
        # Nolio Data
        if i < len(nolio_laps):
            n_lap = nolio_laps[i]
            # Nolio keys might differ, assuming standard naming or we inspect
            # Often: duration (s), distance (m), speed (m/s) or similar
            row['N_Time'] = get_val(n_lap, ['duration', 'time', 'elapsed_time'])
            row['N_Dist'] = get_val(n_lap, ['distance'])
            row['N_AvgSpd'] = get_val(n_lap, ['avg_speed', 'speed_avg', 'mean_speed'])
        else:
            row['N_Time'] = '-'
            row['N_Dist'] = '-'
            row['N_AvgSpd'] = '-'
            
        # Delta
        if row['F_Time'] != '-' and row['N_Time'] != '-':
             row['Δ_Time'] = round(row['F_Time'] - row['N_Time'], 2)
        else:
             row['Δ_Time'] = '-'
             
        table_data.append(row)
        
    print(tabulate(table_data, headers="keys", floatfmt=".2f"))
    
    # 7. Deep Dive into Lap 1 if mismatch
    if len(table_data) > 0:
        print("\n🔍 Deep Dive Lap 1 Data Raw:")
        if len(fit_laps) > 0:
            print("FIT:", fit_laps[0])
        if len(nolio_laps) > 0:
            print("NOLIO:", nolio_laps[0])
        else:
            print("NOLIO: No lap data found (Raw keys):", list(details.keys()))

if __name__ == "__main__":
    # Target: Edouard Tiret, 2025-04-03
    # File: ./data/test_cache/Edouard_2025-04-03.fit
    
    audit_session(
        "Edouard", 
        "2025-04-03", 
        "./data/test_cache/Edouard_2025-04-03.fit"
    )
