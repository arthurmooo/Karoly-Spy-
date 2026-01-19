
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator
import requests

def test_list_planned(nolio_id):
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"--- Listing Planned Workouts for athlete {nolio_id} ---")
    url = "https://www.nolio.io/api/get/planned/training/"
    # Try filtering by athlete and date range
    params = {
        "athlete_id": nolio_id, 
        "from": "2026-01-07", 
        "to": "2026-01-07"
    }
    res = requests.get(url, headers=headers, params=params)
    
    if res.status_code == 200:
        data = res.json()
        print(f"✅ Success! Found {len(data)} planned sessions.")
        if data:
            pid = data[0]['nolio_id']
            print(f"\n--- Testing Detail for Planned ID: {pid} ---")
            # Try adding structure=1 or other common params
            res_det = requests.get(url, headers=headers, params={"id": pid, "athlete_id": nolio_id})
            if res_det.status_code == 200:
                print(json.dumps(res_det.json()[0], indent=2))
    else:
        print(f"❌ Failed: {res.status_code}")
        print(res.text)

if __name__ == "__main__":
    # Adrien Claeyssen
    test_list_planned(57896)
