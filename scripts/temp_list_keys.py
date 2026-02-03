
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient

def list_all_keys(nolio_id):
    client = NolioClient()
    metrics = client.get_athlete_metrics(nolio_id)
    print(f"Keys for {nolio_id}:")
    for k in sorted(metrics.keys()):
        print(f"- {k}")

if __name__ == "__main__":
    list_all_keys(138748)
