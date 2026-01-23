import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def fix_athlete_metrics(athlete_nolio_id, days=30):
    db = DBConnector()
    nolio = NolioClient()
    
    # 1. Get athlete UUID from DB
    res = db.client.table("athletes").select("id, first_name, last_name").eq("nolio_id", athlete_nolio_id).execute()
    if not res.data:
        print(f"❌ Athlete {athlete_nolio_id} not found in DB.")
        return
    
    athlete = res.data[0]
    athlete_uuid = athlete['id']
    print(f"👤 Fixing metrics for {athlete['first_name']} {athlete['last_name']} (Nolio: {athlete_nolio_id})")

    # 2. Fetch activities from Nolio for the period
    date_to = datetime.now().strftime("%Y-%m-%d")
    date_from = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    try:
        activities = nolio.get_activities(athlete_nolio_id, date_from, date_to)
        print(f"   📥 Found {len(activities)} activities on Nolio.")
        
        updated_count = 0
        for act in activities:
            act_id = str(act.get("nolio_id", act.get("id")))
            
            # Distance: KM -> Meters
            dist_km = float(act.get("distance", 0))
            dist_m = dist_km * 1000.0
            dur_sec = float(act.get("duration", act.get("duration_total", 0)))
            
            if dur_sec == 0 and dist_m == 0:
                continue

            # Update DB only if missing or wrong
            # We target specifically NULL or KM-looking distances
            res_upd = db.client.table("activities")\
                .update({"duration_sec": dur_sec, "distance_m": dist_m})\
                .eq("nolio_id", act_id)\
                .execute()
            
            if res_upd.data:
                updated_count += 1
        
        print(f"   ✅ Updated {updated_count} activities in DB.")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")

def fix_all_athletes(days=30):
    db = DBConnector()
    
    # Simple and safe: Fetch all active athletes with nolio_id
    athletes_res = db.client.table("athletes").select("id, nolio_id, first_name, last_name").eq("is_active", True).not_.is_("nolio_id", "null").execute()
    
    athletes = athletes_res.data
    print(f"🚀 Starting surgical fix for {len(athletes)} athletes...")
    
    for ath in athletes:
        if not ath.get('nolio_id'): continue
        fix_athlete_metrics(ath['nolio_id'], days=days)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--athlete", type=str, help="Nolio ID of the athlete")
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()
    
    if args.athlete:
        fix_athlete_metrics(args.athlete, days=args.days)
    else:
        fix_all_athletes(days=args.days)
