
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_profiles():
    db = DBConnector()
    
    # Get mapped athletes
    query = db.client.table("athletes").select("id, first_name, last_name, nolio_id")
    query = query.not_.is_("nolio_id", "null")
    res = query.execute()
    mapped_athletes = res.data
    
    print(f"Checking physio profiles for {len(mapped_athletes)} mapped athletes...\n")
    
    missing_profiles = []
    
    for ath in mapped_athletes:
        # Check if they have at least one profile entry
        p_query = db.client.table("physio_profiles").select("id")
        p_query = p_query.eq("athlete_id", ath["id"])
        p_query = p_query.eq("profile_state", "fresh")
        p_query = p_query.limit(1)
        prof_res = p_query.execute()
            
        if not prof_res.data:
            full_name = f"{ath['first_name']} {ath['last_name']}"
            missing_profiles.append(full_name)
    
    if missing_profiles:
        print(f"❌ {len(missing_profiles)} athletes have NO physio profile (LT1/LT2) in DB!")
        print("Examples:", ", ".join(missing_profiles[:5]))
        print("\n⚠️  If we import their activities, Load Calculation will FAIL.")
    else:
        print("✅ All mapped athletes have at least one physio profile. Ready for ingestion.")

if __name__ == "__main__":
    check_profiles()
