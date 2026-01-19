import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator
import requests

def inspect_athlete(nolio_id):
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Correct endpoint for metadata (custom fields)
    url = f"https://www.nolio.io/api/get/user/meta/"
    params = {"athlete_id": nolio_id}
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        print(f"--- Metadata for Athlete {nolio_id} ---")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    # Test with Adrien Claeyssen (ID: 57896)
    inspect_athlete(57896)