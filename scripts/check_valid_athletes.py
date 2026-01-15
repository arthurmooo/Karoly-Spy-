
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_strict_validity():
    db = DBConnector()
    
    print("=== Checking for VALID Profiles (LT1 & LT2 present) ===")
    
    # 1. Get athletes with Nolio ID
    res = db.client.table("athletes").select("id, first_name, last_name, nolio_id").not_.is_("nolio_id", "null").execute()
    candidates = res.data
    
    valid_athletes = []
    
    for ath in candidates:
        # Check for non-null LT1/LT2
        p_query = db.client.table("physio_profiles").select("*")
        p_query = p_query.eq("athlete_id", ath["id"])
        p_query = p_query.not_.is_("lt1_hr", "null")
        p_query = p_query.not_.is_("lt2_hr", "null")
        p_query = p_query.limit(1)
        
        prof_res = p_query.execute()
        
        if prof_res.data:
            valid_athletes.append(ath)
            
    print(f"✅ Found {len(valid_athletes)} athletes ready for Scientific Calculation.")
    for va in valid_athletes:
        print(f" - {va['first_name']} {va['last_name']}")
        
    return valid_athletes

if __name__ == "__main__":
    check_strict_validity()
