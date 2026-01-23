import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_webhooks():
    db = DBConnector()
    print("Checking webhook_events status...")
    try:
        # Get all events to see columns
        res = db.client.table("webhook_events").select("*").execute()
        events = res.data
        
        print(f"📊 Total Webhook Events: {len(events)}")
        
        if not events:
            print("   ✅ No events found in table.")
            return

        processed = [e for e in events if e.get('processed')]
        errors = [e for e in events if e.get('error_message')]
        
        print(f"✅ Processed: {len(processed)}")
        print(f"❌ Errors: {len(errors)}")
        
        if errors:
            print("\nRecent Errors:")
            for err in errors[-3:]:
                print(f"  - ID: {err['id']} | Error: {err['error_message']}")

        print("\nAvailable Columns:", events[0].keys())
        
        # Most recent by id if no created_at
        sorted_events = sorted(events, key=lambda x: x.get('id', 0), reverse=True)
        print("\nMost Recent Events (by ID):")
        for r in sorted_events[:5]:
            proc_status = "✅" if r.get('processed') else "⏳"
            print(f"  - [ID: {r.get('id')}] {proc_status} Provider: {r.get('provider')}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_webhooks()
