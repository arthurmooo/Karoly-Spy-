
import os
import requests
import json
from dotenv import load_dotenv
from projectk_core.integrations.nolio import NolioClient

load_dotenv()

def probe_hrv_endpoints(athlete_id):
    client = NolioClient()
    headers = client._get_headers()
    
    endpoints = [
        (f"{client.BASE_URL}/get/user/meta/", {"athlete_id": athlete_id, "type": "rmssd"}),
        (f"{client.BASE_URL}/get/user/meta/", {"athlete_id": athlete_id, "type": "hrv"}),
        (f"{client.BASE_URL}/get/user/meta/", {"athlete_id": athlete_id, "category": "hrv"}),
        (f"{client.BASE_URL}/get/user/meta/", {"athlete_id": athlete_id, "category": "sna"}),
        (f"{client.BASE_URL}/get/hrv/", {"athlete_id": athlete_id}),
        (f"{client.BASE_URL}/get/user/hrv/", {"athlete_id": athlete_id}),
        (f"{client.BASE_URL}/get/sna/", {"athlete_id": athlete_id}),
        (f"{client.BASE_URL}/get/user/sna/", {"athlete_id": athlete_id}),
        (f"{client.BASE_URL}/get/user/meta/", {"athlete_id": athlete_id, "limit": 1000})
    ]
    
    print(f"🚀 Probing endpoints for athlete {athlete_id}...")
    
    for url, params in endpoints:
        try:
            r = requests.get(url, headers=headers, params=params)
            print(f"URL: {url} | Params: {params} | Status: {r.status_code}")
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict):
                    keys = list(data.keys())
                    print(f"   ✅ Keys found: {keys}")
                    if 'rmssd' in keys or 'hrv' in keys or 'sna' in keys:
                        print(f"   ✨ FOUND HRV DATA!")
                        print(json.dumps(data, indent=2)[:500])
                elif isinstance(data, list) and len(data) > 0:
                    print(f"   ✅ List found with {len(data)} items. Sample: {str(data[0])[:200]}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    # Hadrien Tabou: 717708
    probe_hrv_endpoints(717708)
