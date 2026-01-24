
import os
from projectk_core.integrations.nolio import NolioClient
from dotenv import load_dotenv

load_dotenv()

def debug_nolio_fit_presence():
    client = NolioClient()
    
    # On prend un athlète au hasard dans tes logs qui avait des "Missing FIT"
    # Hadrien Tabou (717708) par exemple
    athlete_id = 717708
    
    print(f"--- FETCHING ACTIVITIES LIST FOR ATHLETE {athlete_id} ---")
    activities = client.get_activities(athlete_id, "2026-01-20", "2026-01-24")
    
    if not activities:
        print("No activities found in range.")
        return

    for act in activities:
        act_id = act.get('id') or act.get('nolio_id')
        has_url = 'file_url' in act and act['file_url'] is not None
        print(f"Activity {act_id} ({act.get('sport')}): Has file_url in list? {has_url}")
        
        if not has_url:
            print(f"   🔍 Fetching FULL DETAILS for {act_id}...")
            details = client.get_activity_details(act_id, athlete_id=athlete_id)
            if details and 'file_url' in details and details['file_url']:
                print(f"   ✅ FOUND file_url in details: {details['file_url'][:50]}...")
            else:
                print(f"   ❌ Still no file_url in details.")

if __name__ == "__main__":
    debug_nolio_fit_presence()
