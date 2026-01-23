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
    
    sport_map = {
        "Bike": ["Vélo", "Cyclisme", "VTT", "Cycling", "Biking", "Road cycling", "Virtual ride", "Mountain cycling", "Gravel"],
        "Swim": ["Natation", "Swimming", "Nage"],
        "Strength": ["Renforcement musculaire", "Musculation", "PPG", "Strength", "Marche", "Gainage"],
        "Ski": ["Ski de randonnée", "Ski de fond"],
        "Run": ["Course à pied", "Running", "Trail", "Jogging", "Randonnée", "Rando"]
    }
    
    updates = 0
    for act in activities:
        db_id = act['id']
        source_sport = act.get('source_sport') or ""
        activity_name = act.get('activity_name') or ""
        current_sport = act.get('sport_type')
        current_work = act.get('work_type')
        
        # A. Re-classify Sport
        found_category = None
        source_lower = source_sport.lower()
        for category, keywords in sport_map.items():
            if any(kw.lower() in source_lower for kw in keywords):
                found_category = category
                break
        
        new_sport = found_category or "Other"
        
        # B. Re-classify Work Type (Endurance / Intervals / Competition)
        # We simulate the detect_work_type but without the signal (df empty)
        # which will rely on title keywords.
        new_work = classifier.detect_work_type(
            pd.DataFrame(), 
            activity_name, 
            source_sport
        )
        
        # C. Update if changed
        if new_sport != current_sport or new_work != current_work:
            print(f"   ✨ Updating {act['nolio_id']}: {current_sport}->{new_sport} | {current_work}->{new_work} ({activity_name})")
            db.client.table("activities").update({
                "sport_type": new_sport,
                "work_type": new_work
            }).eq("id", db_id).execute()
            updates += 1
            
    print(f"\n✅ Reprocessing complete. {updates} activities updated.")

if __name__ == "__main__":
    reprocess_all_offline()
