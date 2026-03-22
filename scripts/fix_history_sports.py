import os
import sys
import time
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def get_internal_sport(nolio_sport: str) -> str:
    from projectk_core.logic.sport_mapper import normalize_sport
    return normalize_sport(nolio_sport or "")

def fix_history():
    db = DBConnector()
    nolio = NolioClient()
    
    print("🔍 Fetching activities from DB...")
    # Order by session_date to fix newest first
    # We fix everything that doesn't have source_sport yet
    # We join with athletes to get their nolio_id (required for coach API)
    res = db.client.table("activities")\
        .select("id, nolio_id, sport_type, source_sport, athletes(nolio_id)")\
        .is_("source_sport", "null")\
        .order("session_date", desc=True)\
        .limit(30)\
        .execute()
    activities = res.data
    print(f"   Found {len(activities)} activities to check.")

    update_count = 0
    
    for i, act in enumerate(activities):
        act_id = act['nolio_id']
        athlete_nolio_id = act.get('athletes', {}).get('nolio_id')
        
        if not act_id or not athlete_nolio_id:
            continue
            
        if i % 10 == 0:
            print(f"   Processing {i}/{len(activities)}...")
        
        # Sleep to be nice to Nolio
        time.sleep(0.1)
            
        details = nolio.get_activity_details(act_id, athlete_id=athlete_nolio_id)
        if not details:
            continue
            
        nolio_sport = details.get('sport')
        correct_sport = get_internal_sport(nolio_sport)
        
        update_data = {"source_sport": nolio_sport}
        
        if correct_sport != act['sport_type']:
            print(f"      🔄 Fixing {act_id}: {act['sport_type']} -> {correct_sport} (Nolio: {nolio_sport})")
            update_data["sport_type"] = correct_sport
        else:
            print(f"      ✅ Labeling {act_id}: {correct_sport} (Nolio: {nolio_sport})")
            
        db.client.table("activities").update(update_data).eq("id", act['id']).execute()
        update_count += 1

    print(f"\n🏁 Finished. Updated {update_count} activities.")

if __name__ == "__main__":
    fix_history()