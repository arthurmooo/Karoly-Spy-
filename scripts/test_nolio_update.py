import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def test_update(activity_id, athlete_id):
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
    url = "https://www.nolio.io/api/update/training/"
    
    # Tentative A: description + id + athlete_id
    payload_a = {
        "id": activity_id,
        "description": "📊 [Test Project K] Test description A",
        "athlete_id": athlete_id
    }
    
    # Tentative B: comment + id + athlete_id
    payload_b = {
        "id": activity_id,
        "comment": "📊 [Test Project K] Test comment B",
        "athlete_id": athlete_id
    }

    for name, payload in [("A (description)", payload_a), ("B (comment)", payload_b)]:
        print(f"Testing Payload {name}...")
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            print(f"✅ Success with {name}!")
            return
        else:
            print(f"❌ Failed {name}: {response.status_code} - {response.text}")

if __name__ == "__main__":
    # Thibault Montmeat: 207260, Activity: 89837591
    test_update(89837591, 207260)
