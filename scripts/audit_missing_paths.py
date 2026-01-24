import os
from projectk_core.db.connector import DBConnector
from dotenv import load_dotenv

load_dotenv()

def audit_missing_paths():
    db = DBConnector()
    
    # On cherche les activités qui ont un hash (donc un fichier FIT a été traité) 
    # mais pas de chemin vers le storage.
    res = db.client.table("activities").select("id, nolio_id, sport_type, session_date, fit_file_hash, fit_file_path").execute()
    
    total = len(res.data)
    missing_path = [r for r in res.data if r.get('fit_file_hash') and not r.get('fit_file_path')]
    
    print(f"Total activities in DB: {total}")
    print(f"Activities with Hash but NO Path: {len(missing_path)}")
    
    if missing_path:
        print("\nExamples:")
        for r in missing_path[:5]:
            print(f"- {r['nolio_id']} ({r['sport_type']}) on {r['session_date']}")

if __name__ == "__main__":
    audit_missing_paths()
