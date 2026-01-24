
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def find_activities():
    db = DBConnector()
    # Matthieu Poullain
    res = db.client.table("athletes").select("id").eq("last_name", "Poullain").execute()
    if not res.data:
        print("Athlete not found")
        return
    
    athlete_id = res.data[0]['id']
    act_res = db.client.table("activities").select("*").eq("athlete_id", athlete_id).limit(5).execute()
    
    for act in act_res.data:
        print(act)

if __name__ == "__main__":
    find_activities()
