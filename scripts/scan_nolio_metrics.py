import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def scan_all_athletes_metrics():
    client = NolioClient()
    print("📋 Fetching managed athletes...")
    athletes = client.get_managed_athletes()
    print(f"✅ Found {len(athletes)} athletes.")
    
    all_keys = set()
    athletes_with_hrv = []
    
    for ath in athletes:
        name = ath.get('name')
        nid = ath.get('nolio_id')
        print(f"  🔍 Checking {name} ({nid})...")
        try:
            metrics = client.get_athlete_metrics(nid)
            keys = list(metrics.keys())
            all_keys.update(keys)
            
            hrv_keys = [k for k in keys if 'hrv' in k.lower() or 'rmssd' in k.lower()]
            if hrv_keys:
                print(f"    ✨ FOUND HRV DATA for {name}: {hrv_keys}")
                athletes_with_hrv.append({'name': name, 'id': nid, 'keys': hrv_keys})
                
        except Exception as e:
            print(f"    ❌ Error for {name}: {e}")
            
    print("\n--- Summary ---")
    print(f"Total unique metric keys found across all athletes: {sorted(list(all_keys))}")
    if athletes_with_hrv:
        print(f"Athletes with HRV data: {athletes_with_hrv}")
    else:
        print("No athletes currently have HRV/RMSSD data in Nolio.")

if __name__ == "__main__":
    scan_all_athletes_metrics()
