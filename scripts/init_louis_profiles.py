import os
import sys
from datetime import datetime, timezone
from supabase import create_client, Client

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def init_louis_profiles():
    """
    Initializes Bike and Run profiles for Louis Richard (2025).
    """
    db = DBConnector()
    client = db.client
    
    # 1. Find Louis Richard's ID
    response = client.table("athletes").select("id").eq("last_name", "Richard").eq("first_name", "Louis").execute()
    
    if not response.data:
        print("❌ Louis Richard not found in database.")
        return
        
    louis_id = response.data[0]['id']
    print(f"✅ Found Louis Richard: {louis_id}")
    
    # 2. Define Profiles
    # Bike Profile (Source: Nolio / Karoly)
    # LT1=270W, LT2=340W, CP=360W, Weight=64kg
    bike_profile = {
        "athlete_id": louis_id,
        "sport": "bike",
        "valid_from": "2025-01-01T00:00:00+00:00",
        "lt1_power_pace": 270,
        "lt2_power_pace": 340,
        "cp_cs": 360,
        "lt1_hr": 145, # Estimate
        "lt2_hr": 172, # Estimate
        "weight": 64.0
    }
    
    # Run Profile (Source: Karoly)
    # Run uses pure HR for zones (LT1=145, LT2=172) + Weight/Speed for load
    run_profile = {
        "athlete_id": louis_id,
        "sport": "run",
        "valid_from": "2025-01-01T00:00:00+00:00",
        "lt1_hr": 145,
        "lt2_hr": 172,
        "weight": 64.0
    }
    
    # 3. Insert Profiles
    print("\n--- Inserting Bike Profile ---")
    try:
        res_bike = client.table("physio_profiles").insert(bike_profile).execute()
        print("✅ Bike Profile Created")
    except Exception as e:
        print(f"⚠️ Bike Profile Error (maybe exists): {e}")

    print("\n--- Inserting Run Profile ---")
    try:
        res_run = client.table("physio_profiles").insert(run_profile).execute()
        print("✅ Run Profile Created")
    except Exception as e:
        print(f"⚠️ Run Profile Error (maybe exists): {e}")

if __name__ == "__main__":
    init_louis_profiles()
