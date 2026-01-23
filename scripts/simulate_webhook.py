import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def simulate():
    db = DBConnector()
    # Thibault Montmeat: 207260, Activity: 89837591
    payload = {
        "user_id": 207260,
        "workout_id": 89837591,
        "event": "achievement"
    }
    
    print(f"Injecting simulated webhook for Workout {payload['workout_id']}...")
    try:
        res = db.client.table("webhook_events").insert({
            "provider": "nolio",
            "payload": payload,
            "processed": False
        }).execute()
        print(f"✅ Webhook injected. Event ID: {res.data[0]['id']}")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    simulate()
