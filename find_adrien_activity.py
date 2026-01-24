
import os
import sys
from dotenv import load_dotenv
load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector

def find_adrien_activity():
    db = DBConnector()
    
    # 1. Find Adrien
    res = db.client.table("athletes").select("id, first_name, last_name").ilike("last_name", "%Claeyssen%").execute()
    if not res.data:
        print("Adrien Claeyssen not found in athletes table.")
        return
    
    adrien = res.data[0]
    print(f"Found: {adrien['first_name']} {adrien['last_name']} (ID: {adrien['id']})")
    
    # 2. Find Activity on 2026-01-17
    a_res = db.client.table("activities").select("id, nolio_id, activity_name, session_date, fit_file_path").eq("athlete_id", adrien["id"]).ilike("session_date", "2026-01-17%").execute()
    
    if not a_res.data:
        print("No activity found for Adrien on 2026-01-17 in DB.")
        return
    
    for act in a_res.data:
        print(f"Activity Found: {act['activity_name']} | Date: {act['session_date']} | Nolio ID: {act['nolio_id']} | Path: {act['fit_file_path']}")

if __name__ == "__main__":
    find_adrien_activity()
