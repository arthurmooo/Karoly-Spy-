
import sys
import os
import pandas as pd
import numpy as np
import tempfile

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import FitParser
from projectk_core.logic.interval_detector import IntervalDetector
from projectk_core.logic.models import Activity

def inspect_evolution():
    db = DBConnector()
    storage = StorageManager()
    
    # Louis Richard - 24*1'30'' Z2/ r 45'' - Run
    target_id = 'e4927f8b-6635-4a47-a19a-13b9b0e8d4a4'
    
    # Fetch full record
    act = db.client.table("activities").select("*" ).eq("id", target_id).single().execute().data
    
    if not act:
        print("Activity not found!")
        return

    print(f"Analyzing: {act['activity_name']} ({act['sport_type']})")
    
    # Download and Parse
    path = act.get('fit_file_path')
    fit_data = storage.download_fit_file(path)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    try:
        df, _, _ = FitParser.parse(tmp_path)
        
        # Run Interval Detection
        plan = {"duration": 90, "reps": 24}
        detector = IntervalDetector()
        activity_obj = Activity(metadata=None, streams=df)
        
        results = detector.detect(activity_obj, plan)
        blocks = results.get('blocks', [])
        print(f"\nFound {len(blocks)} intervals.")
        
        print("\n--- Evolution of Efficiency (Speed/HR) ---")
        print(f"{'#':<3} | {'Speed (km/h)':<12} | {'HR (bpm)':<10} | {'Ratio (m/s/bpm)':<15} | {'Evolution':<10}")
        print("-" * 60)
        
        ratios = []
        
        for i, block in enumerate(blocks):
            start = block['index']
            duration = block['duration_sec']
            end = start + duration
            
            segment = df.iloc[start:end]
            avg_speed_ms = segment['speed'].mean() if 'speed' in segment.columns else 0
            avg_hr = segment['heart_rate'].mean() if 'heart_rate' in segment.columns else 0
            
            if avg_hr > 0:
                ratio = avg_speed_ms / avg_hr
                ratios.append(ratio)
                speed_kmh = avg_speed_ms * 3.6
                diff = ""
                if i > 0:
                    delta = (ratio - ratios[0]) / ratios[0] * 100
                    diff = f"{delta:+.1f}%"
                
                print(f"{i+1:<3} | {speed_kmh:<12.2f} | {avg_hr:<10.1f} | {ratio:<15.4f} | {diff:<10}")

        if ratios:
            print("-" * 60)
            print(f"Mean Ratio: {sum(ratios)/len(ratios):.4f}")
            print(f"Last Ratio: {ratios[-1]:.4f}")
            print(f"Drop (First to Last): {((ratios[-1] - ratios[0])/ratios[0])*100:+.1f}%")

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    inspect_evolution()
