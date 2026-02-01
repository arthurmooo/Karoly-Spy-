import pytest
from datetime import datetime, timezone
import pandas as pd
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig

def test_elevation_equivalence_logic():
    """
    Verify the elevation equivalence rule: 100m D+ = 1km Flat. 
    
    Test Case:
    - Weight: 70kg
    - Activity A: 10km Flat
    - Activity B: 0km Distance + 1000m D+ (Pure Vertical, theoretical)
    
    Expected: Both should produce IDENTICAL Base Mechanical Cost (before any other factors).
    
    Calculation:
    - A: 70 * (10 + 0/100) = 700 units
    - B: 70 * (0 + 1000/100) = 70 * 10 = 700 units
    """
    config = AthleteConfig()
    calc = MetricsCalculator(config)
    
    profile = PhysioProfile(
        valid_from=datetime.now(timezone.utc),
        weight=70.0,
        lt1_hr=140,
        lt2_hr=170,
        cp=0,
        sport="run"
    )
    
    # Activity A: 10km Flat
    meta_a = ActivityMetadata(
        activity_type="Run",
        start_time=datetime.now(timezone.utc),
        duration_sec=3600,
        distance_m=10000,
        elevation_gain=0
    )
    act_a = Activity(metadata=meta_a, streams=pd.DataFrame({'heart_rate': [140]*3600}))
    
    # Activity B: 0km Distance, 1000m D+
    meta_b = ActivityMetadata(
        activity_type="Run",
        start_time=datetime.now(timezone.utc),
        duration_sec=3600,
        distance_m=0,
        elevation_gain=1000
    )
    act_b = Activity(metadata=meta_b, streams=pd.DataFrame({'heart_rate': [140]*3600}))
    
    # Compute
    res_a = calc.compute(act_a, profile)
    res_b = calc.compute(act_b, profile)
    
    # Assert
    kj_a = res_a['energy_kj']
    kj_b = res_b['energy_kj']
    
    print(f"\n--- ELEVATION LOGIC CHECK ---")
    print(f"Flat 10km Energy: {kj_a}")
    print(f"Vert 1000m Energy: {kj_b}")
    
    assert kj_a == kj_b
    assert kj_a > 0
