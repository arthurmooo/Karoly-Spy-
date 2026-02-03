
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

def check_nolio_source():
    db = DBConnector()
    nolio = NolioClient()
    
    # Prendre 2 Run et 2 Bike sans fichier
    res = db.client.table("activities").select("nolio_id, sport_type, activity_name").is_("fit_file_path", "null").in_("sport_type", ["Run", "Bike"]).limit(4).execute()
    
    for act in res.data:
        nid = act['nolio_id']
        print(f"Vérification Nolio pour {act['sport_type']} - ID {nid} ({act['activity_name']})...")
        try:
            details = nolio.get_activity_details(nid)
            file_url = details.get("file_url")
            print(f"   -> URL de fichier sur Nolio : {'OUI' if file_url else 'NON'}")
        except Exception as e:
            print(f"   -> Erreur Nolio : {e}")

if __name__ == "__main__":
    check_nolio_source()
