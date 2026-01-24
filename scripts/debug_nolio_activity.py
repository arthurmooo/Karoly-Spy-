
import os
import sys
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
        print("\n--- HR Related Fields ---")
        for k, v in activity.items():
            if 'hr' in k.lower() or 'heart' in k.lower():
                print(f"  {k}: {v}")
    else:
        print(f"Activity {nolio_id} (Athlete {athlete_id}) not found.")

if __name__ == "__main__":
    w_id = sys.argv[1] if len(sys.argv) > 1 else 89136000
    a_id = sys.argv[2] if len(sys.argv) > 2 else 21420
    debug_nolio_activity(w_id, a_id)
