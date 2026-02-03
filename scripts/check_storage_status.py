import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector

def check_storage_status():
    db = DBConnector()
    
    # 1. Compter le nombre total d'activités
    total_res = db.client.table("activities").select("id", count="exact").execute()
    total_activities = total_res.count
    
    # 2. Compter les activités avec fit_file_path
    with_path_res = db.client.table("activities").select("id", count="exact").not_.is_("fit_file_path", "null").execute()
    activities_with_path = with_path_res.count
    
    # 3. Compter les activités sans fit_file_path
    without_path_res = db.client.table("activities").select("id", count="exact").is_("fit_file_path", "null").execute()
    activities_without_path = without_path_res.count

    # 4. Vérifier si des activités sans fichier ont quand même un nolio_id (pourraient être récupérées)
    without_path_with_nolio = db.client.table("activities").select("id", count="exact").is_("fit_file_path", "null").not_.is_("nolio_id", "null").execute()
    potential_recoveries = without_path_with_nolio.count

    print(f"Statistiques de stockage des fichiers :")
    print(f"----------------------------------------")
    print(f"Total des activités en base        : {total_activities}")
    print(f"Activités AVEC chemin de fichier   : {activities_with_path} ({activities_with_path/total_activities*100:.1f}%)")
    print(f"Activités SANS chemin de fichier   : {activities_without_path} ({activities_without_path/total_activities*100:.1f}%)")
    print(f"Activités SANS fichier mais avec Nolio ID (récupérables) : {potential_recoveries}")
    
    if activities_without_path > 0:
        print("\nExemples d'activités sans fichier (les 5 premières) :")
        examples = db.client.table("activities").select("id, nolio_id, activity_name, sport_type, session_date").is_("fit_file_path", "null").limit(5).execute()
        for ex in examples.data:
            print(f" - ID: {ex['id']} | Nolio: {ex['nolio_id']} | Date: {ex['session_date']} | Sport: {ex['sport_type']} | Nom: {ex['activity_name']}")

if __name__ == "__main__":
    check_storage_status()
