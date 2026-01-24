from projectk_core.integrations.nolio import NolioClient
from datetime import datetime, timedelta
import requests
import json
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

client = NolioClient()
# Adrien Claeyssen ID? I need to look it up or search by name logic.
try:
    athletes = client.get_managed_athletes()
except Exception as e:
    print(f"Error fetching athletes: {e}")
    exit(1)

adrien = next((a for a in athletes if "Adrien Claeyssen" in a.get('name', '')), None)

if not adrien:
    print("Adrien Claeyssen not found in Nolio managed list.")
    # Fallback to any athlete
    if athletes:
        adrien = athletes[0]
        print(f"Fallback to: {adrien['name']}")
    else:
        exit(1)

athlete_id = adrien['nolio_id']
print(f"Using Athlete: {adrien['name']} (ID: {athlete_id})")

# Look for planned workouts in the NEXT 7 days (Plan is usually future or recent past)
# Let's look at recent past + future
today = datetime.now()
start = (today - timedelta(days=7)).strftime("%Y-%m-%d")
end = (today + timedelta(days=7)).strftime("%Y-%m-%d")

print(f"Fetching planned workouts from {start} to {end}...")

url = f"{client.BASE_URL}/get/planned/training/"
params = {
    "athlete_id": athlete_id,
    "from": start,
    "to": end
}
headers = client._get_headers()
resp = requests.get(url, headers=headers, params=params)
data = resp.json()

print(f"Found {len(data)} planned sessions.")

if data:
    print("Keys in first item:", data[0].keys())
    target = None
    # Find one with structured_workout
    for s in data:
        if 'structured_workout' in s:
            target = s
            break
            
    if target:
        print(f"\nInspecting planned workout: {target.get('name')}")
        print(json.dumps(target.get('structured_workout'), indent=2))
        
        nid = target.get('nolio_id')
        if nid:
            print(f"\nTesting get_planned_workout({nid})...")
            detailed = client.get_planned_workout(nid, athlete_id=athlete_id)
            if detailed:
                print("Detailed fetch successful.")
                # print(json.dumps(detailed, indent=2))
            else:
                print("Detailed fetch failed.")
    else:
        print("No structured_workout found in any item.")
else:
    print("No data found.")
