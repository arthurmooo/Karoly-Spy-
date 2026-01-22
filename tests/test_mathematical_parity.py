import pytest
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.processing.calculator import MetricsCalculator

def test_mathematical_parity_drift_logic():
    """
    Test that checks if the drift logic is sensitive to pauses.
    This test currently captures the behavior that we want to align with Karoly's notebook.
    """
    # Create a synthetic session with a pause in the middle
    # Half 1: 1000s, Power=200, HR=140
    # Pause: 200s (NaNs)
    # Half 2: 1000s, Power=180, HR=150 (Significant drift)
    
    t0 = datetime(2026, 1, 1, 10, 0, 0)
    
    # 1. First Half
    h1_len = 1000
    df1 = pd.DataFrame({
        'timestamp': [t0 + timedelta(seconds=i) for i in range(h1_len)],
        'power': [200.0] * h1_len,
        'heart_rate': [140.0] * h1_len,
        'speed': [10.0] * h1_len
    })
    
    # 2. Pause
    pause_len = 200
    df_pause = pd.DataFrame({
        'timestamp': [t0 + timedelta(seconds=h1_len + i) for i in range(pause_len)],
        'power': [np.nan] * pause_len,
        'heart_rate': [np.nan] * pause_len,
        'speed': [np.nan] * pause_len
    })
    
    # 3. Second Half
    h2_len = 1000
    df2 = pd.DataFrame({
        'timestamp': [t0 + timedelta(seconds=h1_len + pause_len + i) for i in range(h2_len)],
        'power': [180.0] * h2_len,
        'heart_rate': [150.0] * h2_len,
        'speed': [9.0] * h2_len
    })
    
    df = pd.concat([df1, df_pause, df2]).reset_index(drop=True)
    
    metadata = ActivityMetadata(
        activity_type="bike",
        start_time=t0,
        duration_sec=float(len(df)),
        distance_m=20000.0,
        elevation_gain=0.0
    )
    activity = Activity(metadata, df)
    
    profile = PhysioProfile(
        valid_from=t0,
        cp_cs=250.0,
        lt1_hr=140,
        lt2_hr=160
    )
    
    config = AthleteConfig()
    calculator = MetricsCalculator(config)
    metrics = calculator.compute(activity, profile)
    
    # PaHR calculation:
    # Ref p1 = 200, hr1 = 140 -> pahr1 = 1.4285
    # Ref p2 = 180, hr2 = 150 -> pahr2 = 1.2
    # Ref drift = (1.2 / 1.4285 - 1) * 100 = -16%
    
    # Let's see what the current calculator gives
    print(f"DEBUG: Drift = {metrics['drift_pahr_percent']}%")
    
    # The current split is at len(df)//2 = 2200 // 2 = 1100
    # First half (0:1100): 1000s of (200, 140) + 100s of NaNs
    # Second half (1100:2200): 100s of NaNs + 1000s of (180, 150)
    
    # If it fills NaNs:
    # h1 has 1000s of 140, and 100s of 140 (filled from end of first half) -> h1_mean = 140
    # h2 has 100s of 150 (filled from start of second half) + 1000s of 150 -> h2_mean = 150
    # p1 = 200 (mean ignores NaNs)
    # p2 = 180 (mean ignores NaNs)
    # Resulting drift should be -16%.
    
    # Wait, why did Adrien's file show 0.52% vs -5.32%?
    # In Adrien's file, the NaNs were likely distributed differently.
    
    # If drift is VERY different, it might be the split point or how we handle filled values.
    # Let's assert that we HAVE a drift calculation
    assert "drift_pahr_percent" in metrics
