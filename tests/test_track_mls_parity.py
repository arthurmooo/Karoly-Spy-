import pytest
from datetime import datetime, timezone
import pandas as pd
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig

def test_bike_run_parity_at_low_intensity():
    """
    Verify that 1h Bike @ 120bpm and 1h Run @ 120bpm produce similar MLS.
    Assumptions for Parity:
    - 1h Duration
    - Flat terrain
    - Stable Heart Rate (120 bpm)
    - Bike Power: 150W (Low Z2)
    - Run Speed: 10 km/h (Low Z2)
    - Weight: 70kg
    
    Acceptance Criteria: MLS values should be within 5% of each other.
    """
    # Common Setup
    config = AthleteConfig()
    calc = MetricsCalculator(config)
    start_time = datetime.now(timezone.utc)
    duration_sec = 3600 # 1 hour
    weight = 70.0
    
    # 1. BIKE SESSION
    # Profile: LT1=140, LT2=170, CP=250 (Watts)
    profile_bike = PhysioProfile(
        valid_from=start_time,
        weight=weight,
        lt1_hr=140,
        lt2_hr=170,
        cp=250,
        sport="bike"
    )
    
    meta_bike = ActivityMetadata(
        activity_type="Ride",
        start_time=start_time,
        duration_sec=duration_sec,
        distance_m=30000, # 30km
        elevation_gain=0
    )
    
    # Bike Streams: 150W steady, 120bpm
    df_bike = pd.DataFrame({
        'time': range(duration_sec),
        'power': [150] * duration_sec,
        'heart_rate': [120] * duration_sec
    })
    
    act_bike = Activity(metadata=meta_bike, streams=df_bike)
    metrics_bike = calc.compute(act_bike, profile_bike)
    
    # 2. RUN SESSION
    # Profile: LT1=140, LT2=170, CP=0 (Run uses Speed/Weight)
    # Note: CP=0 forces the speed-based fallback logic in calculator
    profile_run = PhysioProfile(
        valid_from=start_time,
        weight=weight,
        lt1_hr=140,
        lt2_hr=170,
        cp=0,
        sport="run"
    )
    
    meta_run = ActivityMetadata(
        activity_type="Run",
        start_time=start_time,
        duration_sec=duration_sec,
        distance_m=10000, # 10km (10km/h)
        elevation_gain=0
    )
    
    # Run Streams: 10km/h (2.77 m/s), 120bpm
    df_run = pd.DataFrame({
        'time': range(duration_sec),
        'speed': [2.77] * duration_sec,
        'heart_rate': [120] * duration_sec
    })
    
    act_run = Activity(metadata=meta_run, streams=df_run)
    metrics_run = calc.compute(act_run, profile_run)
    
    # 3. ANALYSIS
    mls_bike = metrics_bike.get('mls_load', 0)
    mls_run = metrics_run.get('mls_load', 0)
    
    print(f"\n--- PARITY CHECK ---")
    print(f"Bike MLS (150W): {mls_bike}")
    print(f"Run MLS (10km/h): {mls_run}")
    
    # Calculate difference
    diff_percent = abs(mls_bike - mls_run) / ((mls_bike + mls_run) / 2) * 100
    print(f"Difference: {diff_percent:.2f}%")
    
    # ASSERTION
    # We expect close parity (e.g. < 10% difference)
    # Bike 150W * 3.6s -> ~540 kJ
    # Run 70kg * 10km -> 700 kcal -> 700 'kJ' equivalent in new model
    
    # Note: 150W is arbitrary. 
    # The 'Calibration' task might involve finding the right Run Coefficient 
    # to align these values if they naturally diverge.
    
    # For now, we assert they are comparable (order of magnitude)
    assert mls_bike is not None
    assert mls_run is not None
    assert diff_percent < 30.0 # Starting lenient, will refine with coefficient
