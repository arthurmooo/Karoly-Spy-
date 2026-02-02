import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def patch_elevation():
    db = DBConnector()
    
    print("🩹 Patching Elevation for Louis Richard's bad session...")
    
    # Target the specific bad session
    # 2*11Km Tempo/ r 2Km (Run) on 2026-02-01
    
    # 1. Find Activity ID
    res = db.client.table("activities").select("id, activity_name, elevation_gain") \
        .eq("activity_name", "2*11Km Tempo/ r 2Km") \
        .gte("session_date", "2026-02-01") \
        .lt("session_date", "2026-02-02") \
        .execute()
    
    if not res.data:
        print("❌ Activity not found.")
        return
        
    act = res.data[0]
    print(f"found: {act}")
    
    if act['elevation_gain'] > 30000:
        print(f"⚠️ Detected massive elevation: {act['elevation_gain']}m. Patching to 300m.")
        
        # 2. Update DB
        db.client.table("activities").update({"elevation_gain": 300}).eq("id", act['id']).execute()
        print("✅ Elevation patched.")
    else:
        print("Elevation seems normal, no patch needed.")

if __name__ == "__main__":
    patch_elevation()
