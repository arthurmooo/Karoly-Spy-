
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_results():
    db = DBConnector()
    res = db.client.table("athletes").select("id").eq("last_name", "Poullain").execute()
    athlete_id = res.data[0]['id']
    
    act_res = db.client.table("activities").select("nolio_id, session_date, avg_hr, avg_power, sport_type").eq("athlete_id", athlete_id).order("session_date", desc=True).limit(5).execute()
    
    print("Recent Activities for Matthieu Poullain:")
    for act in act_res.data:
        print(f"Date: {act['session_date']} | Nolio ID: {act['nolio_id']} | Sport: {act['sport_type']} | HR: {act['avg_hr']} | Power: {act['avg_power']}")

if __name__ == "__main__":
    check_results()
