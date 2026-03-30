import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def check_yesterday():
    db = DBConnector()
    nolio = NolioClient()
    
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Checking activities for: {yesterday}")
    
    # 1. Get athletes from DB
    athletes = db.client.table("athletes").select("id, first_name, last_name, nolio_id").eq("is_active", True).execute().data
    
    total_nolio = 0
    total_db = 0
    missing = []
    
    for ath in athletes:
        import time
        time.sleep(2.0) # Add 2s delay between athletes
        nid = ath['nolio_id']
        name = f"{ath['first_name']} {ath['last_name']}"
        if not nid:
            continue
            
        # Get activities from Nolio
        try:
            # Ensure nid is an int for Nolio API
            nolio_acts = nolio.get_activities(int(nid), yesterday, yesterday)
            nolio_ids = [str(a.get('nolio_id', a.get('id'))) for a in nolio_acts]
            total_nolio += len(nolio_ids)
            
            # Get activities from DB - Correct filtering for PostgREST
            # Use gte and lt to cover the whole day
            start_dt = f"{yesterday}T00:00:00Z"
            end_dt = f"{yesterday}T23:59:59Z"
            
            db_acts = db.client.table("activities").select("nolio_id").eq("athlete_id", ath['id']).gte("session_date", start_dt).lte("session_date", end_dt).execute().data
            db_ids = [str(a['nolio_id']) for a in db_acts]
            total_db += len(db_ids)
            
            # Compare
            for nid_act in nolio_ids:
                if nid_act not in db_ids:
                    missing.append({
                        "athlete": name,
                        "nolio_id": nid_act,
                        "date": yesterday
                    })
                    
        except Exception as e:
            print(f"Error checking {name} (Nolio ID: {nid}): {e}")

    print(f"\nSummary for {yesterday}:")
    print(f"Total on Nolio: {total_nolio}")
    print(f"Total in DB:    {total_db}")
    
    if missing:
        print(f"\n⚠️ Missing {len(missing)} activities:")
        for m in missing:
            print(f" - {m['athlete']} (Nolio ID: {m['nolio_id']})")
    else:
        print("\n✅ All activities are in sync for yesterday!")

if __name__ == "__main__":
    check_yesterday()
