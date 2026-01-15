import os
import requests
import base64
from dotenv import load_dotenv
load_dotenv()

client_id = os.environ.get("NOLIO_CLIENT_ID")
client_secret = os.environ.get("NOLIO_CLIENT_SECRET")
refresh_token = os.environ.get("NOLIO_REFRESH_TOKEN")

print(f"Using Client ID: {client_id[:5]}...")
print(f"Using Refresh Token: {refresh_token[:5]}...")

auth_str = f"{client_id}:{client_secret}"
b64_auth = base64.b64encode(auth_str.encode()).decode()
headers_auth = {"Authorization": f"Basic {b64_auth}", "Content-Type": "application/x-www-form-urlencoded"}
data_auth = {"grant_type": "refresh_token", "refresh_token": refresh_token}

res_token = requests.post("https://www.nolio.io/api/token/", headers=headers_auth, data=data_auth)
print(f"Token Refresh Status: {res_token.status_code}")
print(f"Token Refresh Body: {res_token.text}")

if res_token.status_code == 200:
    access_token = res_token.json().get("access_token")
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    url = "https://www.nolio.io/api/get/training/"
    params = {"athlete_id": 57896, "from": "2026-01-01", "to": "2026-01-15"}
    res = requests.get(url, headers=headers, params=params)
    print(f"API Status: {res.status_code}")
    print(f"API Body: {res.text}")