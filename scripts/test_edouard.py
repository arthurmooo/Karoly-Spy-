import os
import sys
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.run_ingest import IngestionRobot

def test_specific_sessions(athlete_name, dates):
    robot = IngestionRobot(history_days=1) # Minimal window by default
    
    # Trouver l'athlète
    res = robot.db.client.table("athletes").select("id, nolio_id").ilike("first_name", f"%{athlete_name}%").execute()
    if not res.data:
        print(f"❌ Athlète {athlete_name} non trouvé.")
        return
    
    athlete = res.data[0]
    athlete_uuid = athlete['id']
    nolio_id = athlete['nolio_id']
    
    print(f"🎯 Test ciblé sur {athlete_name} (Nolio: {nolio_id})")
    
    for d_str in dates:
        print(f"\n--- Analyse de la date : {d_str} ---")
        try:
            # On force la fenêtre sur le jour J
            activities = robot.nolio.get_activities(nolio_id, d_str, d_str)
            if not activities:
                print(f"   ⚠️ Aucune séance trouvée au {d_str}")
                continue
            
            for act in activities:
                # On supprime si déjà existant pour recalculer proprement
                act_id = str(act.get("id"))
                robot.db.client.table("activities").delete().eq("nolio_id", act_id).execute()
                
                # Ingestion
                robot.process_activity(athlete_uuid, act, athlete_nolio_id=nolio_id)
                
                # Vérification
                res_db = robot.db.client.table("activities").select("nolio_id, elevation_gain, load_index, source_sport").eq("nolio_id", act_id).execute()
                if res_db.data:
                    data = res_db.data[0]
                    print(f"   ✅ Séance : {data.get('source_sport')} (ID: {act_id})")
                    print(f"   📊 Dénivelé (D+) : {data.get('elevation_gain')}m")
                    print(f"   🔥 Karoly Load (MLS) : {data.get('load_index')}")
                    
        except Exception as e:
            print(f"   ❌ Erreur sur {d_str} : {e}")

if __name__ == "__main__":
    test_dates = ["2025-06-25", "2025-06-08", "2025-04-03"]
    test_specific_sessions("Edouard", test_dates)
