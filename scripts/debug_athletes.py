from projectk_core.integrations.nolio import NolioClient
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

client = NolioClient()
try:
    athletes = client.get_managed_athletes()
    print(f"Found {len(athletes)} athletes.")
    if athletes:
        print("First athlete keys:", athletes[0].keys())
        for a in athletes[:5]:
            print(a)
except Exception as e:
    print(f"Error fetching athletes: {e}")
