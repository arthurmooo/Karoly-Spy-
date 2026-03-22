import pytest
from datetime import datetime, timezone
import pandas as pd
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig

def test_run_energy_excludes_conversion_factor():
    """
    Verify that energy calculation for Running NO LONGER applies the 4.184 factor.
    Legacy Logic: weight * (dist + ascent/100) * 4.184
    New Logic: weight * (dist + ascent/100)  (Direct 'Calorie-equivalent' as mechanical work)
    """
    # Setup
    config = AthleteConfig()
    calc = MetricsCalculator(config)
    
    profile = PhysioProfile(
        valid_from=datetime.now(timezone.utc),
        weight=70.0,
        lt1_hr=140,
        lt2_hr=170,
        cp=0, # Low CP -> Force Speed/Weight logic
        sport="run"
    )
    
    # 1km distance, 0 elevation
    meta = ActivityMetadata(
        activity_type="Run",
        start_time=datetime.now(timezone.utc),
        duration_sec=300,
        distance_m=1000,
        elevation_gain=0
    )
    
    # Dummy streams
    df = pd.DataFrame({
        'time': range(300),
        'speed': [3.33] * 300, # 12km/h
        'heart_rate': [145] * 300
    })
    
    activity = Activity(metadata=meta, streams=df)
    
    # Execute
    metrics = calc.compute(activity, profile)
    
    # Expected Calculation:
    # kcal = 70.0 * (1.0 + 0) = 70.0
    # energy_kj = kcal * RUN_COEFF(0.77) = 53.9
    # RUN_COEFF aligns Run MLS with Bike MLS at equivalent effort

    # If 4.184 was applied, result would be ~292.88

    assert metrics['energy_kj'] == pytest.approx(53.9, abs=0.1)
    assert metrics['mec'] is not None
    # Intensity factor should be applied to MEC
    # IF calculation depends on CP which is 0 here, so fallback logic applies.
    # We focus on the base energy check first.
