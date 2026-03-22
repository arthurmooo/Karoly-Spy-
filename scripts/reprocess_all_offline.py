import os
import sys
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.logic.classifier import ActivityClassifier

def reprocess_all_offline():
    db = DBConnector()
    classifier = ActivityClassifier()
    
    # 1. Fetch all activities
    print("🔍 Fetching all activities from DB...")
    res = db.client.table("activities").select("id, nolio_id, activity_name, source_sport, sport_type, work_type").execute()
    activities = res.data
    
    print(f"📊 Found {len(activities)} activities to re-process.")
    
    from projectk_core.logic.sport_mapper import normalize_sport

    updates = 0
    for act in activities:
        db_id = act['id']
        source_sport = act.get('source_sport') or ""
        activity_name = act.get('activity_name') or ""
        current_sport = act.get('sport_type')
        current_work = act.get('work_type')

        # A. Re-classify Sport
        new_sport = normalize_sport(source_sport)
        
        # B. Re-classify Work Type (Endurance / Intervals / Competition)
        # We simulate the detect_work_type but without the signal (df empty)
        # which will rely on title keywords and generic title logic.
        new_work = classifier.detect_work_type(
            pd.DataFrame(), 
            activity_name, 
            source_sport,
            sport_name=new_sport # Pass the detected sport for Title == Sport check
        )
        
        # C. Update if changed
        if new_sport != current_sport or new_work != current_work:
            print(f"   ✨ Updating {act['nolio_id']}: {current_sport}->{new_sport} | {current_work}->{new_work} ({activity_name})")
            
            update_payload = {
                "sport_type": new_sport,
                "work_type": new_work
            }
            
            # Cleaning metrics if it was intervals and is not anymore
            if current_work == "intervals" and new_work != "intervals":
                update_payload.update({
                    "interval_power_mean": None,
                    "interval_power_last": None,
                    "interval_hr_mean": None,
                    "interval_hr_last": None,
                    "interval_pace_mean": None,
                    "interval_pace_last": None,
                    "interval_respect_score": None
                })

            db.client.table("activities").update(update_payload).eq("id", db_id).execute()
            updates += 1
            
    print(f"\n✅ Reprocessing complete. {updates} activities updated.")

if __name__ == "__main__":
    reprocess_all_offline()
