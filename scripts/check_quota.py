import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def check_headers():
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = "https://www.nolio.io/api/get/athletes/"
    
    print(f"Calling: {url}")
    response = requests.get(url, headers=headers)
    
    print("\n--- Response Headers ---")
    for k, v in response.headers.items():
        if "limit" in k.lower() or "remaining" in k.lower() or "reset" in k.lower():
            print(f"{k}: {v}")
    
    if response.status_code == 200:
        print("\n✅ Call successful.")
    else:
        print(f"\n❌ Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    check_headers()
