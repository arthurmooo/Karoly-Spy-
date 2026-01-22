
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def inspect_metrics(nolio_id):
    client = NolioClient()
    print(f"🔍 Fetching metrics for athlete {nolio_id}...")
    try:
        metrics = client.get_athlete_metrics(nolio_id)
        print("✅ Raw metrics keys found:")
        print(list(metrics.keys()))
        
        # Check for HRV/RMSSD specifically
        for key in metrics:
            if 'hrv' in key.lower() or 'rmssd' in key.lower():
                print(f"✨ Found potential HRV key: {key}")
                print(json.dumps(metrics[key], indent=2))
        
        # Save a sample to a temp file for deeper inspection if needed
        with open('temp_metrics_sample.json', 'w') as f:
            json.dump(metrics, f, indent=2)
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    # Adrien Claeyssen: 57896
    inspect_metrics(57896)
