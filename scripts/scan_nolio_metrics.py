import os
from projectk_core.integrations.nolio import NolioClient
from dotenv import load_dotenv

load_dotenv()

def scan_nolio_metrics():
    client = NolioClient()
    athlete_id = 1824
    workout_id = 90040306
    
    print(f"--- Scanning Nolio for workout {workout_id} ---")
    activities = client.get_activities(athlete_id, "2026-01-24", "2026-01-24")
    
    found = False
    for act in activities:
        if str(act.get('id')) == str(workout_id) or str(act.get('nolio_id')) == str(workout_id):
            print("✅ Found activity in list view.")
            print(f"Full keys: {act.keys()}")
            print(f"Selected values: {{k: v for k, v in act.items() if 'hr' in k.lower() or 'avg' in k.lower() or 'bpm' in k.lower()}}")
            found = True
            break
            
    if not found:
        print("❌ Activity not found in list view for today.")
        
    details = client.get_activity_details(workout_id, athlete_id=athlete_id)
    if details:
        print("\n✅ Found activity in details view.")
        print(f"Full keys: {details.keys()}")
        print(f"Selected values: {{k: v for k, v in details.items() if 'hr' in k.lower() or 'avg' in k.lower() or 'bpm' in k.lower()}}")
        # Check if there is anything inside 'zones'
        if 'zones' in details:
            print(f"Zones keys: {details['zones'].keys()}")
            if 'heart_rate' in details['zones']:
                print(f"HR Zones: {details['zones']['heart_rate']}")

if __name__ == "__main__":
    scan_nolio_metrics()