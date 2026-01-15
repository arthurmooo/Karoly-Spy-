import os
import sys
import pandas as pd
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig

def run_batch():
    sample_dir = "data/samples"
    files = [f for f in os.listdir(sample_dir) if f.endswith(".fit")]
    
    results = []
    
    # Context commun pour comparaison
    profile = PhysioProfile(
        lt1_hr=160, lt2_hr=175, cp=300,
        valid_from=datetime(2024, 1, 1, tzinfo=timezone.utc)
    )
    config = AthleteConfig()
    calc = MetricsCalculator(config)

    print(f"--- Analyse Batch de {len(files)} fichiers ---")

    for file in files:
        path = os.path.join(sample_dir, file)
        try:
            df, _ = FitParser.parse(path)
            meta = ActivityMetadata(
                activity_type="Run",
                start_time=df['timestamp'].iloc[0],
                duration_sec=len(df)
            )
            activity = Activity(metadata=meta, streams=df)
            metrics = calc.compute(activity, profile)
            
            # Enrichissement pour le tableau
            metrics['file'] = file
            metrics['duration_min'] = round(len(df) / 60, 1)
            metrics['avg_power_brute'] = round(df['power'].mean(), 1) if 'power' in df.columns else 0.0
            metrics['avg_hr_brute'] = round(df['heart_rate'].mean(), 1) if 'heart_rate' in df.columns else 0.0
            
            results.append(metrics)
            print(f"✅ Analysé : {file}")
        except Exception as e:
            print(f"❌ Erreur sur {file} : {e}")

    # Présentation des résultats
    if results:
        res_df = pd.DataFrame(results)
        # Ordonner les colonnes pour la lecture
        cols = [
            'file', 'duration_min', 'avg_power_brute', 'avg_hr_brute', 
            'drift_pahr_percent', 'mls_load', 'tss', 'int_index', 'dur_index'
        ]
        print("\n=== RÉCAPITULATIF DES SÉANCES ===")
        print(res_df[cols].to_string(index=False))

if __name__ == "__main__":
    run_batch()
