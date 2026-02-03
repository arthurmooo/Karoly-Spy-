
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def debug_athlete_hr(nolio_id):
    client = NolioClient()
    print(f"🔍 Fetching metrics for athlete {nolio_id}...")
    metrics = client.get_athlete_metrics(nolio_id)
    
    keys_to_check = ["restinghr", "hrrest", "hr_rest", "heartrate_rest"]
    
    for key in keys_to_check:
        if key in metrics:
            print(f"\n--- KEY: {key} ---")
            data = metrics[key].get("data", [])
            for entry in data[:5]:
                print(f"Date: {entry.get('date')} | Value: {entry.get('value')}")
        else:
            # Try fuzzy match
            for m_key in metrics.keys():
                if key in m_key.lower():
                    print(f"\n--- FUZZY MATCH KEY: {m_key} ---")
                    data = metrics[m_key].get("data", [])
                    for entry in data[:5]:
                        print(f"Date: {entry.get('date')} | Value: {entry.get('value')}")

if __name__ == "__main__":
    # Dries Matthys
    debug_athlete_hr(138748)

