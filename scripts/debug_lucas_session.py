import os
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def debug_lucas():
    db = DBConnector()
    nolio = NolioClient()
    
    # 1. Find Lucas
    res = db.client.table("athletes").select("id, first_name, last_name, nolio_id").ilike("first_name", "%Lucas%").ilike("last_name", "%Hzg%").execute()
    if not res.data:
        print("Lucas not found")
        return
    
    lucas = res.data[0]
    print(f"Found Lucas: {lucas['first_name']} {lucas['last_name']} (Nolio ID: {lucas['nolio_id']})")
    
    # 2. Get activities from Nolio for Jan 22
    date_from = "2026-01-22"
    date_to = "2026-01-22"
    activities = nolio.get_activities(lucas['nolio_id'], date_from, date_to)
    
    print(f"\nActivities for Jan 22:")
    for act in activities:
        # Based on previous run, the key is 'nolio_id'
        act_id = act.get('nolio_id')
        print(f"- Nolio ID: {act_id}, Name: {act.get('name')}, Sport: {act.get('sport')}, Time: {act.get('date_start')}")

    # 3. Check what's in our DB
    db_res = db.client.table("activities").select("id, nolio_id, sport_type, source_sport, activity_name, session_date").eq("athlete_id", lucas['id']).gte("session_date", "2026-01-22").execute()
    print(f"\nActivities in DB:")
    for act in db_res.data:
        print(f"- DB ID: {act['id']}, Nolio ID: {act['nolio_id']}, Sport: {act['sport_type']}, Source: {act['source_sport']}, Name: {act['activity_name']}, Start: {act['session_date']}")

if __name__ == "__main__":
    debug_lucas()
