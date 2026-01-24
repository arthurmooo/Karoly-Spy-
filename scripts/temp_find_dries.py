import os
import requests
from projectk_core.auth.nolio_auth import NolioAuthenticator

def get_dries_id():
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    
    athlete_id = 138748
    start_date = "2026-01-16"
    end_date = "2026-01-18"
    
    # Use planned training or realized training
    url = f"https://www.nolio.io/api/get/training/?athlete_id={athlete_id}&start={start_date}&end={end_date}"
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        activities = response.json()
        for act in activities:
            if "2*9Km" in str(act.get("name")):
                print(f"FOUND! ID: {act.get('training_id') or act.get('id')}, Name: {act.get('name')}")
                # Print all keys to be sure
                print(f"Full entry: {act}")
    else:
        print(f"Error {response.status_code}")

if __name__ == "__main__":
    get_dries_id()
