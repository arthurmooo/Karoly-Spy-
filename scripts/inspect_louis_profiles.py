import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def inspect_profiles():
    db = DBConnector()
    
    # 1. Find Louis Richard's ID
    ath_res = db.client.table("athletes").select("id").eq("last_name", "Richard").execute()
    if not ath_res.data:
        print("❌ Louis Richard not found.")
        return
    athlete_id = ath_res.data[0]['id']
    
    # 2. Fetch Profiles
    res = db.client.table("physio_profiles").select("*").eq("athlete_id", athlete_id).order("valid_from", desc=True).execute()
    
    print(f"👤 Profiles for Louis Richard ({len(res.data)} found):")
    for p in res.data:
        valid_from = p.get('valid_from', '')[:10]
        sport = p.get('sport', 'N/A')
        cp = p.get('cp_cs')
        lt2 = p.get('lt2_power_pace') # For bike usually
        lt2_hr = p.get('lt2_hr')
        
        print(f"   📅 From: {valid_from} | Sport: {sport:<5} | CP: {cp} | LT2(p): {lt2} | LT2(hr): {lt2_hr}")

if __name__ == "__main__":
    inspect_profiles()
