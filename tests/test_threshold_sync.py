import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile, Athlete
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.processing.calculator import MetricsCalculator

def test_threshold_sensitivity():
    """
    Vérifie que le calculateur réagit correctement aux changements de seuils LT1/LT2.
    Scenario: 1h à 145 bpm constant.
    - Si LT1=130, LT2=160 -> Le coeur est à 100% dans la Zone LT1-LT2 -> INT Index élevé.
    - Si LT1=150, LT2=170 -> Le coeur est à 100% sous LT1 -> INT Index = 1.0.
    """
    seconds = 3600
    t0 = datetime(2026, 1, 1)
    
    # Données : 1h stable à 145 bpm, 200W
    df = pd.DataFrame({
        'timestamp': pd.date_range(start=t0, periods=seconds, freq='s'),
        'power': [200.0] * seconds,
        'heart_rate': [145.0] * seconds,
        'speed': [10.0] * seconds
    })
    
    meta = ActivityMetadata(
        activity_type="bike",
        start_time=t0,
        duration_sec=float(seconds),
        distance_m=36000.0
    )
    activity = Activity(meta, df)
    
    config = AthleteConfig()
    calc = MetricsCalculator(config)
    
    # 1. TEST AVEC SEUILS KAROLY (130 / 160)
    profile_karoly = PhysioProfile(
        valid_from=t0,
        lt1_hr=130.0,
        lt2_hr=160.0,
        cp_cs=250.0
    )
    
    res_karoly = calc.compute(activity, profile_karoly)
    
    # 145bpm est entre 130 et 160 -> 100% du temps en Zone 2
    # INT = 1.0 + alpha(0.5) * 1.0 = 1.5
    print(f"\nDEBUG Sync: LT1=130, LT2=160, HR=145 -> INT Index = {res_karoly['int_index']}")
    assert res_karoly['int_index'] == 1.5
    
    # 2. TEST AVEC SEUILS ÉLEVÉS (150 / 180)
    profile_high = PhysioProfile(
        valid_from=t0,
        lt1_hr=150.0,
        lt2_hr=180.0,
        cp_cs=250.0
    )
    
    res_high = calc.compute(activity, profile_high)
    
    # 145bpm est sous 150 -> 0% du temps en Zone 2
    # INT = 1.0 + alpha(0.5) * 0.0 = 1.0
    print(f"DEBUG Sync: LT1=150, LT2=180, HR=145 -> INT Index = {res_high['int_index']}")
    assert res_high['int_index'] == 1.0

if __name__ == "__main__":
    test_threshold_sensitivity()
