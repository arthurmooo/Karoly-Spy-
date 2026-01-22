
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def debug_rmssd_format(nolio_id):
    client = NolioClient()
    print(f"🔍 Fetching RMSSD for athlete {nolio_id}...")
    metrics = client.get_athlete_metrics(nolio_id)
    if 'rmssd' in metrics:
        print("✅ RMSSD Data found:")
        print(json.dumps(metrics['rmssd'], indent=2))
    else:
        print("❌ RMSSD not found for this athlete.")

if __name__ == "__main__":
    # Estelle-Marie Kieffer: 1824
    debug_rmssd_format(1824)
