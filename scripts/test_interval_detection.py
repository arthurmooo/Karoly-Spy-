import sys
import os
import pandas as pd
from datetime import datetime
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.interval_detector import IntervalDetector

def test_batch_detection():
    # Définition des plans "réels" pour les fichiers samples
    test_cases = [
        {
            "file": "data/samples/463411957976825859.fit",
            "name": "Séance 3 x 2000m (Simulé 7 min/rep)",
            "plan": {"type": "time", "duration": 420, "reps": 3} # 2000m à ~3'30/km = 7 min
        },
        {
            "file": "data/samples/467068497455775745.fit",
            "name": "Séance 5 x 1000m (Simulé 3.5 min/rep)",
            "plan": {"type": "time", "duration": 210, "reps": 5} # 1000m à 3'30/km = 3.5 min
        },
        {
            "file": "data/samples/470924462183710821.fit",
            "name": "Séance Seuil 2 x 10 min",
            "plan": {"type": "time", "duration": 600, "reps": 2}
        },
        {
            "file": "data/samples/allure_semi.fit",
            "name": "Sortie Longue Allure Semi (3 x 10 min)",
            "plan": {"type": "time", "duration": 600, "reps": 3}
        }
    ]

    print(f"=== 🏃 TEST DÉTECTION INTERVALLES (PLANS RÉELS) ===")
    
    for case in test_cases:
        file_path = case["file"]
        if not os.path.exists(file_path):
            print(f"\n⚠️ Fichier introuvable : {file_path}")
            continue

        print(f"\n🔹 {case['name']}")
        print(f"   Fichier : {os.path.basename(file_path)}")
        print(f"   Plan    : {case['plan']['reps']} reps de {case['plan']['duration']}s")
        
        try:
            df, meta_dev, laps = FitParser.parse(file_path)
            
            meta = ActivityMetadata(
                activity_type="Run",
                start_time=df['timestamp'].iloc[0] if not df.empty else datetime.now(),
                duration_sec=len(df),
                device_id="Validation"
            )
            activity = Activity(metadata=meta, streams=df, laps=laps)
            
            print(f"   Max Power (Stream): {df['power'].max() if 'power' in df.columns else 'N/A'} W")
            
            # Détection
            results = IntervalDetector.detect(activity, case['plan'])
            
            if results:
                print(f"   ✅ Détecté !")
                print(f"      Puissance (Moyenne) : {results['interval_power_mean']} W")
                print(f"      Puissance (Dernière): {results['interval_power_last']} W")
                print(f"      FC (Moyenne)        : {results['interval_hr_mean']} bpm")
                print(f"      FC (Dernière)       : {results['interval_hr_last']} bpm")
            else:
                print(f"   ❌ Échec de la détection (Aucun pic trouvé)")
                
        except Exception as e:
            print(f"   💥 Erreur : {e}")

if __name__ == "__main__":
    test_batch_detection()