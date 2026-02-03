
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def debug_activity_kylian():
    db = DBConnector()
    print("🔍 Inspecting Kylian Herpin activity on 2026-01-24...")
    
    ath_res = db.client.table("athletes").select("id").ilike("last_name", "Herpin").execute()
    if not ath_res.data:
        print("❌ Athlete not found")
        return
    ath_id = ath_res.data[0]['id']
    
    # Get recent activities
    act_res = db.client.table("activities").select("*").eq("athlete_id", ath_id).order("session_date", desc=True).limit(5).execute()

    if act_res.data:
        for act in act_res.data:
            print(f"✅ Found activity: {act.get('activity_name')} (Date: {act.get('session_date')})")
            print(f"Sport: {act.get('sport_type')} / {act.get('source_sport')}")
            print(f"Work Type: {act.get('work_type')}")
            print(f"Interval Power Last: {act.get('interval_power_last')}")
            print(f"Interval Pace Last: {act.get('interval_pace_last')}")
            print(f"---")


if __name__ == "__main__":
    debug_activity_kylian()
