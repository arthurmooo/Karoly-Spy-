import sys
from datetime import datetime
from projectk_core.db.connector import DBConnector
from projectk_core.logic.profile_manager import ProfileManager

def validate():
    db = DBConnector()
    pm = ProfileManager(db)
    
    # Let's pick an athlete we know has profiles
    # Adrien Claeyssen has profiles on 7/11/25, 8/11/25, 14/11/25
    first_name = "Adrien"
    last_name = "Claeyssen"
    
    response = db.client.table("athletes").select("id").match({
        "first_name": first_name,
        "last_name": last_name
    }).execute()
    
    if not response.data:
        print(f"Athlete {first_name} {last_name} not found.")
        return
        
    athlete_id = response.data[0]["id"]
    
    # Test date: 10 Nov 2025 (should fall under the 8/11/25 profile)
    test_date = datetime(2025, 11, 10)
    sport = "bike"
    
    profile = pm.get_profile_for_date(athlete_id, sport, test_date)
    
    if profile:
        valid_from = datetime.fromisoformat(profile["valid_from"]).strftime("%d %B %Y")
        print(f"✅ Profil de {first_name} chargé pour le {test_date.strftime('%d/%m/%Y')} :")
        print(f"   -> Sport: {sport}")
        print(f"   -> LT2 HR: {profile['lt2_hr']} bpm")
        print(f"   -> LT2 Power: {profile['lt2_power_pace']} W")
        print(f"   -> Calculé sur la base de son test du {valid_from}.")
    else:
        print(f"❌ Aucun profil trouvé pour {first_name} à la date du {test_date.isoformat()}.")

if __name__ == "__main__":
    validate()
