
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator
import requests

def test_deep_details(nolio_id, workout_name):
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get activities
    url = "https://www.nolio.io/api/get/training/"
    params = {"athlete_id": nolio_id, "limit": 20}
    res = requests.get(url, headers=headers, params=params)
    
    if res.status_code == 200:
        activities = res.json()
        for act in activities:
            if workout_name in act.get('name', ''):
                wid = act.get('nolio_id')
                print(f"🎯 Target Found: {act.get('name')} (ID: {wid})")
                
                # Test A: Get details via /get/training/ with specific ID
                print(f"\n--- Testing /get/training/?id={wid} ---")
                res_det = requests.get(url, headers=headers, params={"id": wid, "athlete_id": nolio_id})
                if res_det.status_code == 200:
                    data = res_det.json()
                    if not data:
                        print("❌ Received empty list []")
                        return
                    det = data[0]
                    print(f"Keys in details: {det.keys()}")
                    if 'structure' in det:
                        print("✅ Found 'structure'!")
                        print(json.dumps(det['structure'], indent=2))
                    else:
                        print("❌ No 'structure' field in details.")
                
                # Test B: Get details via /get/planned/training/ (if we can find an ID)
                # Sometimes the structure is only in the planned object
                return
    else:
        print(f"❌ Failed: {res.status_code}")

if __name__ == "__main__":
    # Test with Dries Matthys (ID: 138748) and the 9*200 session
    test_deep_details(138748, "9*200")
