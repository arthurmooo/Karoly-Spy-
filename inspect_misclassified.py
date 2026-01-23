import os
import sys
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def inspect_potential_issues():
    db = DBConnector()
    
    print("--- Fetching potentially misclassified activities ---")
    
    # Fetch all for local filtering
    res = db.client.table("activities").select("nolio_id, activity_name, source_sport, sport_type, work_type").execute()
    activities = res.data
    
    print(f"Total activities: {len(activities)}")
    
    suspects = []
    
    keywords_sport_checks = [
        ("Ski", "Run"), # Ski classified as Run?
        ("Tapis", "Run"), # Tapis classified as Run (maybe OK, but check)
        ("Home Trainer", "Bike"), # HT as Bike (maybe OK)
        ("Zwift", "Bike"),
        ("Renfo", "Strength"),
        ("Muscu", "Strength")
    ]
    
    print("\n--- Potential Sport Mismatches ---")
    for act in activities:
        name = (act['activity_name'] or "").lower()
        sport = act['sport_type']
        source = (act['source_sport'] or "").lower()
        
        # Check Ski
        if "ski" in name or "ski" in source:
            if sport == "Run":
                print(f"[SKI?] {act['nolio_id']} | {act['activity_name']} | Sport: {sport} | Source: {act['source_sport']}")

        # Check Renfo/Muscu but classified as something else
        if ("renfo" in name or "muscu" in name or "ppg" in name) and sport != "Strength":
             print(f"[STRENGTH?] {act['nolio_id']} | {act['activity_name']} | Sport: {sport}")

    print("\n--- Potential Interval Misses (Endurance with numbers) ---")
    for act in activities:
        if act['work_type'] == "endurance":
            name = (act['activity_name'] or "").lower()
            # Look for patterns like "10x", "30/30", "Z3", "Z4"
            if "x" in name or "/" in name or "z3" in name or "z4" in name or "test" in name:
                 print(f"[INTERVAL?] {act['nolio_id']} | {act['activity_name']} | Type: {act['work_type']}")

if __name__ == "__main__":
    inspect_potential_issues()
