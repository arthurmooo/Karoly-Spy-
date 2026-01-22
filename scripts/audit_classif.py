
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def audit_wrong_classif():
    db = DBConnector()
    # Let's find activities that are "Run" but maybe should be "Bike" based on common sense
    # (Actually we want to see those that are NOT Bike and NOT Run)
    # But the user said "quasi tout le temps classés comme 'run'"
    
    res = db.client.table("activities").select("id, sport_type, nolio_id").eq("sport_type", "Run").execute()
    
    print(f"Total 'Run' activities: {len(res.data)}")
    
    # We can't easily check Nolio names without another API call or if we stored the raw name.
    # Did we store the raw activity name? 
    # Check migration 005_add_activity_name.sql
    
if __name__ == "__main__":
    audit_wrong_classif()
