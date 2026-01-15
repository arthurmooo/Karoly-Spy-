
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def inject_dummy_thresholds():
    print("=== Injecting DUMMY Thresholds for Adrien Claeyssen ===")
    db = DBConnector()
    
    # 1. Find Adrien
    res = db.client.table("athletes").select("id").eq("first_name", "Adrien").eq("last_name", "Claeyssen").single().execute()
    adrien_id = res.data["id"]
    print(f"Found Adrien: {adrien_id}")
    
    # 2. Check if profile exists
    prof_res = db.client.table("physio_profiles").select("id").eq("athlete_id", adrien_id).execute()
    
    dummy_data = {
        "athlete_id": adrien_id,
        "sport": "bike", # Default sport, logic usually handles fallback
        "lt1_hr": 135,
        "lt2_hr": 165,
        "lt1_power_pace": 200, # Watts
        "lt2_power_pace": 300, # Watts
        "valid_from": "2024-01-01"
    }
    
    if prof_res.data:
        # Update existing
        print("Updating existing profile with DUMMY values...")
        db.client.table("physio_profiles").update(dummy_data).eq("athlete_id", adrien_id).execute()
    else:
        # Create new
        print("Creating new profile with DUMMY values...")
        db.client.table("physio_profiles").insert(dummy_data).execute()
        
    print("✅ DUMMY thresholds injected. READY for Test Ingestion.")

if __name__ == "__main__":
    inject_dummy_thresholds()
