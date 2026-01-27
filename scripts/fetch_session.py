import os
import sys
import json
from datetime import datetime, timezone
from projectk_core.integrations.nolio import NolioClient

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def main():
    client = NolioClient()
    
    # Seraphin Barbot
    athlete_nolio_id = 29817
    target_date = "2026-01-27"
    
    print(f"🔍 Searching activities for Athlete {athlete_nolio_id} on {target_date}...")
    
    activities = client.get_activities(athlete_nolio_id, target_date, target_date)
    
    if not activities:
        print("❌ No activities found.")
        return
        
    print(f"✅ Found {len(activities)} activities.")
    
    for act in activities:
        print(f"   - {act.get('name')} (ID: {act.get('id')})")
        
        # We want the one that likely has sprints, probably a Bike/HT session
        # For now, we'll take the first one or filter if needed.
        # Assuming only one session or we take the first relevant one.
        
        # Save Metadata
        filename_base = f"data/samples/seraphin_sprint_{act.get('id')}"
        with open(f"{filename_base}.json", "w") as f:
            json.dump(act, f, indent=2)
        print(f"     📄 Metadata saved to {filename_base}.json")
        
        # Download FIT
        file_url = act.get("file_url")
        if file_url:
            print("     ⬇️ Downloading FIT file...")
            fit_data = client.download_fit_file(file_url)
            if fit_data:
                with open(f"{filename_base}.fit", "wb") as f:
                    f.write(fit_data)
                print(f"     💾 FIT file saved to {filename_base}.fit")
            else:
                print("     ❌ Failed to download FIT data.")
        else:
            print("     ⚠️ No file_url found for this activity.")

if __name__ == "__main__":
    main()
