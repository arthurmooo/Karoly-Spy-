import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def inspect_louis_feb1():
    db = DBConnector()
    
    # 1. Find Louis Richard's ID
    ath_res = db.client.table("athletes").select("id").eq("last_name", "Richard").execute()
    if not ath_res.data:
        print("❌ Louis Richard not found.")
        return
    athlete_id = ath_res.data[0]['id']
    
    # 2. Fetch Feb 1st activities
    target_date = "2026-02-01"
    res = db.client.table("activities").select(
        "activity_name, sport_type, duration_sec, distance_m, elevation_gain, avg_hr, avg_power, load_index, durability_index, decoupling_index, mec, energy_kj"
    ).eq("athlete_id", athlete_id).gte("session_date", target_date).lt("session_date", "2026-02-02").execute()
    
    if not res.data:
        print("❌ No activities found for Feb 1st.")
        return
        
    print(f"📊 Louis Richard - Activities on {target_date}:")
    for act in res.data:
        print(f"\n🏷️  {act['activity_name']} ({act['sport_type']})")
        print(f"   ⏱️  Duration: {act['duration_sec']/60:.1f} min")
        print(f"   📏 Distance: {act['distance_m']/1000:.1f} km")
        print(f"   ⛰️  Elevation: {act['elevation_gain']} m")
        print(f"   💓 Avg HR: {act['avg_hr']}")
        print(f"   ⚡ Avg Power: {act['avg_power']}")
        print(f"   📈 MLS Load: {act['load_index']}")
        print(f"   🏗️  MEC: {act['mec']}")
        print(f"   🔋 Energy (kJ): {act['energy_kj']}")
        print(f"   📉 Durability: {act['durability_index']}")
        print(f"   ↔️  Decoupling: {act['decoupling_index']}%")

if __name__ == "__main__":
    inspect_louis_feb1()
