
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def check_all_headers():
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = "https://www.nolio.io/api/get/athletes/"
    
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    for k, v in response.headers.items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    check_all_headers()
