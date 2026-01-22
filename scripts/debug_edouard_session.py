import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from scripts.run_ingest import IngestionRobot

def debug_single_session(athlete_nolio_id, activity_id):
    robot = IngestionRobot(history_days=1)
    
    # Trouver l'athlète UUID
    res = robot.db.client.table("athletes").select("id").eq("nolio_id", athlete_nolio_id).execute()
    athlete_uuid = res.data[0]['id']
    
    print(f"🔍 Récupération de la séance {activity_id} pour l'athlète {athlete_nolio_id}...")
    try:
        act = robot.nolio.get_activity_details(activity_id, athlete_id=athlete_nolio_id)
        if not act:
            print("❌ Séance non trouvée ou Rate Limit.")
            return

        print(f"✅ Séance récupérée : {act.get('name')} ({act.get('sport')})")
        print(f"📊 Données Nolio : D+ = {act.get('elevation_pos')}m, Distance = {act.get('distance')}km")

        # Force suppression pour recalcul
        robot.db.client.table("activities").delete().eq("nolio_id", str(activity_id)).execute()
        
        # Lancement du traitement
        robot.process_activity(athlete_uuid, act, athlete_nolio_id=athlete_nolio_id)
        
        # Lecture du résultat final
        res_db = robot.db.client.table("activities").select("*").eq("nolio_id", str(activity_id)).execute()
        if res_db.data:
            data = res_db.data[0]
            print("\n🚀 --- RÉSULTAT FINAL SUPABASE ---")
            print(f"   Dénivelé enregistré : {data.get('elevation_gain')} m")
            print(f"   Score Karoly (MLS)  : {data.get('load_index')}")
            print(f"   Durabilité (Index)  : {data.get('durability_index')}")
            print(f"   Work Type détecté   : {data.get('work_type')}")
        
    except Exception as e:
        print(f"❌ Erreur : {e}")

if __name__ == "__main__":
    # Edouard Tiret: 25787, Séance 2x1km Vertical: 72766530
    debug_single_session(25787, 72766530)
