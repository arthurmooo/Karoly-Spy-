
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def debug_activity():
    db = DBConnector()
    print("🔍 Inspecting Hadrien Tabou activity on 2026-01-24...")
    
    # First find the athlete ID
    ath_res = db.client.table("athletes").select("id").ilike("last_name", "Tabou").execute()
    if not ath_res.data:
        print("❌ Athlete not found")
        return
    ath_id = ath_res.data[0]['id']
    
    # Get the activity
    act_res = db.client.table("activities").select("*").eq("athlete_id", ath_id).eq("session_date", "2026-01-24").execute()
    
    if not act_res.data:
        # Try without the exact timestamp if session_date is a timestamp
        act_res = db.client.table("activities").select("*").eq("athlete_id", ath_id).gte("session_date", "2026-01-24").lte("session_date", "2026-01-24 23:59:59").execute()

    if act_res.data:
        act = act_res.data[0]
        print(f"✅ Found activity: {act.get('activity_name')} (ID: {act.get('id')})")
        print(f"Sport: {act.get('sport_type')} / {act.get('source_sport')}")
        print(f"Work Type: {act.get('work_type')}")
        print(f"Interval Power Last: {act.get('interval_power_last')}")
        print(f"Interval Power Mean: {act.get('interval_power_mean')}")
        print(f"Interval Pace Last: {act.get('interval_pace_last')}")
        print(f"Interval Pace Mean: {act.get('interval_pace_mean')}")
        print(f"Segmented Metrics keys: {list(act.get('segmented_metrics', {}).keys()) if act.get('segmented_metrics') else 'None'}")
    else:
        print("❌ Activity not found for this date/athlete")

if __name__ == "__main__":
    debug_activity()
