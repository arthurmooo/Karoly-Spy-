
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_sports():
    db = DBConnector()
    res = db.client.table("activities").select("nolio_id, sport_type").limit(100).execute()
    
    if res.data:
        print(f"Sample of 100 activities:")
        for row in res.data:
            print(f"Nolio ID: {row['nolio_id']}, Sport Type: {row['sport_type']}")
    else:
        print("No activities found.")

if __name__ == "__main__":
    check_sports()
