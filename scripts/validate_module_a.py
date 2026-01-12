import sys
import os
import pandas as pd
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile, Athlete
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.writer import ActivityWriter

def validate_pipeline(file_path):
    print(f"--- Validation du Pipeline Module A sur {file_path} ---")
    
    # 1. Parsing
    print("\n[1] Parsing...")
    try:
        df = FitParser.parse(file_path)
        print(f"    OK. Rows: {len(df)}")
        print(f"    Duration: {len(df)/60:.1f} min")
        print(f"    Avg Power: {df['power'].mean():.1f} W")
        print(f"    Avg HR: {df['heart_rate'].mean():.1f} bpm")
    except Exception as e:
        print(f"    FAIL Parsing: {e}")
        return

    # 2. Setup Context
    print("\n[2] Context Setup...")
    # Profil fictif mais réaliste pour tester les algo
    profile = PhysioProfile(
        lt1_hr=160,
        lt2_hr=175,
        cp=300, # Critical Power
        valid_from=datetime(2024, 1, 1, tzinfo=timezone.utc)
    )
    
    config = AthleteConfig() # Use defaults + DB mocks if connected, but here defaults mostly
    
    meta = ActivityMetadata(
        activity_type="Run", # On force Run
        start_time=df['timestamp'].iloc[0],
        duration_sec=len(df),
        device_id="ValidationScript"
    )
    
    activity = Activity(metadata=meta, streams=df)
    
    # 3. Calculation
    print("\n[3] Calculation (The Brain)...")
    calc = MetricsCalculator(config)
    metrics = calc.compute(activity, profile)
    activity.metrics = metrics
    
    for k, v in metrics.items():
        print(f"    {k}: {v}")
        
    # Validation de cohérence
    if metrics['mls_load'] > 0:
        print("    -> MLS Load généré avec succès.")
    else:
        print("    WARNING: MLS Load is 0 or NaN.")

    # 4. Serialization
    print("\n[4] Serialization (Dry Run)...")
    record = ActivityWriter.serialize(activity, athlete_id="test-athlete", file_path=file_path)
    
    print("    Record ready for DB:")
    print(f"    Load Index: {record['load_index']}")
    print(f"    Durability Index: {record['durability_index']}")
    print(f"    Decoupling: {record['decoupling_index']}% ")
    
    print("\n--- Validation Terminée ---")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        file = sys.argv[1]
    else:
        file = "allure_semi.fit"
        
    if os.path.exists(file):
        validate_pipeline(file)
    else:
        print(f"Fichier {file} introuvable.")
