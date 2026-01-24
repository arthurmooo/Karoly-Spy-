import os, requests, json
from projectk_core.auth.nolio_auth import NolioAuthenticator
auth = NolioAuthenticator()
token = auth.get_valid_token()
headers = {"Authorization": f"Bearer {token}"}
url = "https://www.nolio.io/api/get/user/meta/"
response = requests.get(url, headers=headers, params={"athlete_id": 3245})
data = response.json()
for k, v in data.items():
    entries = v.get("data", [])
    if entries:
        print(f"{k}: {entries[0].get('value')} ({entries[0].get('date')})")
