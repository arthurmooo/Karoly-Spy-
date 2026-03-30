import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def debug_estelle():
    db = DBConnector()
    nolio = NolioClient()
    
    yesterday = "2026-01-25"
    athlete_id = "837286de-3d2f-4c15-97a2-c6272775dc56" # Estelle UUID
    nolio_id = 1824
    
    nolio_acts = nolio.get_activities(nolio_id, yesterday, yesterday)
    print(f"Nolio found {len(nolio_acts)} activities for {yesterday}")
    
    for act in nolio_acts:
        nid = str(act.get('nolio_id', act.get('id')))
        name = act.get('name')
        
        exists = db.client.table("activities").select("id").eq("nolio_id", nid).execute()
        if exists.data:
            print(f"✅ DB has {nid} ({name})")
        else:
            print(f"❌ DB MISSING {nid} ({name})")

if __name__ == "__main__":
    debug_estelle()
