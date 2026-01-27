
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.logic.classifier import ActivityClassifier

def reprocess():
    db = DBConnector()
    classifier = ActivityClassifier()
    
    # Target Nolio IDs from spec/diagnosis
    # 1. Matthieu Poullain (2026-01-27, Natation le midi) -> 90259158
    # 2. Ludovic Marchand (2026-01-27, Vélo - Route) -> 90309581
    # 3. Ludovic Marchand (2026-01-27, Vélo - Home Trainer) -> 90324301
    
    nolio_ids = ["90259158", "90309581", "90324301"]
    
    for nid in nolio_ids:
        # Fetch activity
        act_res = db.client.table("activities").select("*").eq("nolio_id", nid).execute()
        if not act_res.data:
            print(f"Activity {nid} not found in DB.")
            continue
            
        activity = act_res.data[0]
        
        # Fetch intervals (laps)
        int_res = db.client.table("activity_intervals").select("*").eq("activity_id", activity["id"]).execute()
        # Rename keys for classifier compatibility if needed (total_distance -> distance_m? No, classifier uses total_distance)
        # Wait, activity_intervals uses avg_speed and duration. We need to reconstruct total_distance.
        laps = []
        for row in int_res.data:
            lap = {
                "total_distance": (row.get("avg_speed") or 0) * (row.get("duration") or 0),
                "total_timer_time": row.get("duration") or 0,
                "avg_speed": row.get("avg_speed") or 0,
                "avg_power": row.get("avg_power") or 0
            }
            laps.append(lap)
            
        print(f"Processing '{activity['activity_name']}' (ID: {nid}, Sport: {activity['sport_type']})")
        print(f"   Current type: {activity['work_type']}")
        
        # Re-run classification
        # We don't have the streams (df) easily here, but we have the laps
        new_type = classifier.detect_work_type(
            df=None, 
            title=activity["activity_name"] or "", 
            nolio_type=activity.get("source_sport") or "", 
            sport_name=activity["sport_type"] or "",
            laps=laps
        )
        
        if new_type != activity["work_type"]:
            print(f"   ✨ Updating: {activity['work_type']} -> {new_type}")
            db.client.table("activities").update({"work_type": new_type}).eq("id", activity["id"]).execute()
        else:
            print(f"   ✅ No change needed (detected: {new_type})")

if __name__ == "__main__":
    reprocess()
