
import os
import requests
from dotenv import load_dotenv
load_dotenv()
from projectk_core.auth.nolio_auth import NolioAuthenticator
import json

def check_headers():
    try:
        auth = NolioAuthenticator()
        token = auth.get_valid_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        url = "https://www.nolio.io/api/get/athletes/"
        
        print("Making request to:", url)
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print("--- Headers ---")
        for k, v in response.headers.items():
            if "limit" in k.lower() or "remaining" in k.lower():
                print(f"{k}: {v}")
        
        # Also print all headers just in case I miss the naming convention
        print(json.dumps(dict(response.headers), indent=2))

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_headers()
