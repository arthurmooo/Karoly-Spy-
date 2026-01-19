import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator
import requests

def find_intervals_and_test(nolio_id):
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get recent activities to find an interval session
    print(f"--- Searching activities for athlete {nolio_id} ---")
    url = "https://www.nolio.io/api/get/training/"
    params = {"athlete_id": nolio_id, "limit": 10}
    res = requests.get(url, headers=headers, params=params)
    
    if res.status_code == 200:
        activities = res.json()
        if activities:
            print(f"Keys in activity: {activities[0].keys()}")
        print(f"Found {len(activities)} activities:")
        for act in activities:
            print(f" - {act.get('name')} (ID: {act.get('id')})")
        
        for act in activities:
            name = act.get('name', '').lower()
            # On cherche des mots clés typiques d'intervalles
            if any(k in name for k in ['vma', 'seuil', 'x', 'bloc', 'fractionné']):
                print(f"🎯 Found potential interval session: {act.get('name')} (ID: {act.get('id')})")
                print(f"   - Planned ID: {act.get('planned_id')}")
                print(f"   - Has structure field: {act.get('structure') is not None}")
                
                # Show full JSON for this one
                print("\n--- Full Activity JSON ---")
                print(json.dumps(act, indent=2))
                
                if act.get('planned_id'):
                    print(f"\n--- Fetching Planned Workout {act.get('planned_id')} ---")
                    res_p = requests.get("https://www.nolio.io/api/get/planned/training/", headers=headers, params={"id": act.get('planned_id')})
                    if res_p.status_code == 200:
                        print(json.dumps(res_p.json(), indent=2))
                return
        print("❌ No interval session found in the last 10 activities.")
    else:
        print(f"❌ Failed to fetch activities: {res.status_code}")

if __name__ == "__main__":
    # Test with Dries Matthys (ID: 138748)
    find_intervals_and_test(138748)
