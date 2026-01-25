
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.logic.classifier import ActivityClassifier

def reprocess():
    db = DBConnector()
    classifier = ActivityClassifier()
    
    # Target IDs found earlier
    targets = [
        {"id": "84a6d530-abb6-49ab-ae77-c2f51979f5c8", "name": "Run and Bike La Wantzenau"},
        {"id": "620f1d6c-1d22-4867-a415-588cf43b5424", "name": "Sortie vélo le matin (Matthieu)"},
        {"id": "582c4cbb-adf4-4cb5-bd07-51452a40e131", "name": "Sortie vélo dans l'après-midi (Matthieu)"},
        {"id": "118384c3-ab5a-4a7e-b826-dd77b3f4aae8", "name": "Sortie vélo le matin (Matthieu)"},
        {"id": "acd3e9e2-9cef-40b3-a66d-9e631975869b", "name": "Sortie vélo le matin (Matthieu)"},
        {"id": "0ec8a0a8-455a-45e0-8e70-dfe9f07f6428", "name": "Sortie vélo dans l'après-midi (Matthieu)"}
    ]
    
    for target in targets:
        # Fetch current data to be safe
        res = db.client.table("activities").select("*").eq("id", target["id"]).execute()
        if not res.data:
            print(f"Not found: {target['name']} ({target['id']})")
            continue
            
        activity = res.data[0]
        # Re-run classification
        # For simplicity, we assume no plan/target_grid for these generic ones as per our investigation
        new_type = classifier.detect_work_type(
            df=None, 
            title=activity["activity_name"], 
            nolio_type=activity.get("source_sport") or "", 
            sport_name=activity["sport_type"]
        )
        
        # Also check is_competition separately to be sure
        if classifier.is_competition(activity["activity_name"], activity.get("source_sport") or ""):
            new_type = "competition"
        
        if new_type != activity["work_type"]:
            print(f"Updating {target['name']}: {activity['work_type']} -> {new_type}")
            db.client.table("activities").update({"work_type": new_type}).eq("id", target["id"]).execute()
        else:
            print(f"No change for {target['name']} ({new_type})")

if __name__ == "__main__":
    reprocess()
