import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def fetch_recent_sports():
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get managed athletes
    res = requests.get("https://www.nolio.io/api/get/athletes/", headers=headers)
    athletes = res.json()
    
    sports_found = set()
    
    for a in athletes[:5]: # Check first 5 athletes
        nid = a.get('nolio_id')
        name = a.get('name')
        print(f"Checking {name} (ID: {nid})...")
        
        url = "https://www.nolio.io/api/get/training/"
        res_act = requests.get(url, headers=headers, params={"athlete_id": nid, "limit": 20})
        if res_act.status_code == 200:
            activities = res_act.json()
            for act in activities:
                sport = act.get('sport')
                sports_found.add(sport)
                
    print("\nSports found in Nolio:")
    for s in sorted(list(sports_found)):
        print(f" - {s}")

if __name__ == "__main__":
    fetch_recent_sports()
