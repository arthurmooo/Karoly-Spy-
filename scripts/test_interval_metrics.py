
import os
import sys
import tempfile
from datetime import datetime, timezone
import pandas as pd

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile, ActivityMetrics
from projectk_core.logic.config_manager import AthleteConfig

def test_metrics():
    db = DBConnector()
    storage = StorageManager()
    
    # Activity: 7*3' Z3/ r 2' for Louis Richard
    activity_id = '853e46e5-73b4-4ec4-88b2-4d89acc9229c'
    athlete_id = '1cc0cd46-e5a0-4a94-8b49-2df03be964fb'
    
    # 1. Fetch Activity Metadata from DB
    res = db.client.table("activities").select("* ").eq("id", activity_id).single().execute()
    act_data = res.data
    if not act_data:
        print("Activity not found")
        return
        
    print(f"Athlete: Louis Richard")
    print(f"Date: {act_data['session_date']}")
    print(f"Activity: {act_data['activity_name']}")
    print(f"Nolio ID: {act_data['nolio_id']}")
    
    # 2. Fetch Physio Profile
    res_p = db.client.table("physio_profiles").select("* ").eq("athlete_id", athlete_id).order("valid_from", desc=True).limit(1).execute()
    if not res_p.data:
        print("Profile not found")
        return
    p_data = res_p.data[0]
    profile = PhysioProfile(
        lt1_hr=p_data['lt1_hr'],
        lt2_hr=p_data['lt2_hr'],
        cp_cs=p_data.get('cp_cs') or p_data.get('lt2_power_pace') or 3.0,
        weight=p_data.get('weight') or 70.0,
        valid_from=datetime.fromisoformat(p_data['valid_from'].replace('Z', '+00:00'))
    )
    print(f"Profile: LT1={profile.lt1_hr}, LT2={profile.lt2_hr}, CP={profile.cp}")

    # 3. Download and Parse FIT
    # We need the fit_file_hash or path. The record has fit_file_hash.
    # In StorageManager, it might be stored by hash or by path.
    # Let's check storage path convention. 
    # Usually it's {athlete_id}/{year}/{nolio_id}.fit
    year = datetime.fromisoformat(act_data['session_date'].replace('Z', '+00:00')).year
    storage_path = f"{athlete_id}/{year}/{act_data['nolio_id']}.fit"
    
    print(f"Downloading FIT from: {storage_path}")
    fit_content = storage.download_fit_file(storage_path)
    if not fit_content:
        print("Could not download FIT file")
        return
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_content)
        tmp_path = tmp.name
        
    try:
        df, meta_fit, laps = FitParser.parse(tmp_path)
        
        # Construct Activity object
        meta = ActivityMetadata(
            activity_name=act_data['activity_name'],
            activity_type=act_data['sport_type'],
            start_time=df['timestamp'].iloc[0],
            duration_sec=act_data['duration_sec'],
            distance_m=act_data['distance_m'],
            elevation_gain=act_data['elevation_gain']
        )
        activity = Activity(metadata=meta, streams=df, laps=laps)
        
        # 4. Calculate Metrics
        config = AthleteConfig()
        calc = MetricsCalculator(config)
        
        # We don't have target_grid here yet, so it will use LAPS fallback
        # Let's see what the laps look like
        print(f"\nFound {len(laps)} laps in FIT file.")
        
        results = calc.compute(activity, profile)
        
        print("\n=== Calculated Interval Metrics (Mean & Last) ===")
        print(f"Interval Power Mean: {results['interval_power_mean']} W")
        print(f"Interval Power Last: {results['interval_power_last']} W")
        print(f"Interval HR Mean:    {results['interval_hr_mean']} bpm")
        print(f"Interval HR Last:    {results['interval_hr_last']} bpm")
        print(f"Interval Pace Mean:  {results['interval_pace_mean']} min/km")
        print(f"Interval Pace Last:  {results['interval_pace_last']} min/km")
        print(f"Interval Pa:HR Mean: {results.get('interval_pahr_mean')}")
        print(f"Interval Pa:HR Last: {results.get('interval_pahr_last')}")
        
        print("\n=== Lap by Lap Detail (Laps from device) ===")
        print(f"{ 'Lap':<4} | { 'Duration':<10} | { 'Power':<8} | { 'HR':<8} | { 'Pace':<10} | { 'Ratio':<10}")
        print("-" * 65)
        
        for i, lap in enumerate(laps):
            dur = lap.get('total_elapsed_time', 0)
            p = lap.get('avg_power', 0) or 0
            hr = lap.get('avg_heart_rate', 0) or 0
            speed = lap.get('avg_speed', 0) or 0
            pace = 1000.0 / speed / 60.0 if speed > 0 else 0
            
            # Efficiency ratio (Power/HR or Speed/HR)
            # Louis is running here, so we might want Speed/HR if no power
            ratio = p/hr if p > 0 and hr > 0 else (speed/hr if speed > 0 and hr > 0 else 0)
            
            print(f"{i+1:<4} | {dur:<10.0f} | {p:<8.1f} | {hr:<8.1f} | {pace:<10.2f} | {ratio:<10.4f}")

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    test_metrics()
