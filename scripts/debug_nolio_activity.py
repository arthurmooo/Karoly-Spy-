
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def debug_nolio_activity(nolio_id, athlete_id=None):
    client = NolioClient()
    activity = client.get_activity_details(nolio_id, athlete_id=athlete_id)
    if activity:
        print(f"Activity {nolio_id} details:")
        print(f"  duration_total: {activity.get('duration_total')}")
        print(f"  duration: {activity.get('duration')}")
        print(f"  distance: {activity.get('distance')}")
        print(f"  elevation_pos: {activity.get('elevation_pos')}")
        print(f"  elevation_gain: {activity.get('elevation_gain')}")
        print(f"  file_url: {activity.get('file_url')}")
        print(f"  All keys: {list(activity.keys())}")
        if 'laps' in activity:
            print(f"✅ Found 'laps' ({len(activity['laps'])})")
        if 'segments' in activity:
            print(f"✅ Found 'segments' ({len(activity['segments'])})")
        if 'structure' in activity:
            print(f"✅ Found 'structure'")
        
        # Save full JSON for inspection
        with open('activity_debug.json', 'w') as f:
            json.dump(activity, f, indent=2)
        print("📝 Full JSON saved to activity_debug.json")
    else:
        print(f"Activity {nolio_id} (Athlete {athlete_id}) not found.")

if __name__ == "__main__":
    w_id = sys.argv[1] if len(sys.argv) > 1 else 89136000
    a_id = sys.argv[2] if len(sys.argv) > 2 else 21420
    debug_nolio_activity(w_id, a_id)
