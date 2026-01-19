import pandas as pd
import numpy as np
from datetime import datetime, timezone
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.config_manager import AthleteConfig

def test_smart_segmentation():
    print("🧪 Testing Smart Segmentation Logic...")
    
    # 1. Create Dummy Data (1 hour at 1Hz)
    n = 3600
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2026-01-19 10:00:00', periods=n, freq='1s'),
        'heart_rate': np.linspace(140, 160, n), # Linear drift
        'speed': np.full(n, 12.0 / 3.6), # Constant 12km/h in m/s
        'distance': np.linspace(0, 12000, n)
    })
    
    # 2. Config & Profile
    config = AthleteConfig()
    profile = PhysioProfile(
        valid_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        lt1_hr=135,
        lt2_hr=165,
        lt2_power_pace=4.0, # 4m/s reference
        cp_cs=4.0
    )
    
    calc = MetricsCalculator(config)
    
    # CASE A: Competition (Auto 2/4 phases)
    print("\n--- Case A: Competition (Auto Split) ---")
    meta_comp = ActivityMetadata(
        activity_type="Run",
        start_time=datetime(2026, 1, 19, 10, 0, tzinfo=timezone.utc),
        duration_sec=3600,
        distance_m=12000
    )
    act_comp = Activity(metadata=meta_comp, streams=df)
    
    # Simulation of classification as competition
    res_comp = calc.compute(act_comp, profile, nolio_type="Competition")
    
    seg = res_comp['segmented_metrics']
    print(f"Segmentation Type: {seg.segmentation_type}")
    print(f"Splits 2 phases: {len(seg.splits_2)}")
    print(f"Splits 4 phases: {len(seg.splits_4)}")
    print(f"Drift Percent: {seg.drift_percent:.2f}%")
    
    # CASE B: Manual Split via Comment (#split:0-5km,5-12km)
    print("\n--- Case B: Manual Splits (#split tag) ---")
    meta_manual = ActivityMetadata(
        activity_type="Run",
        start_time=datetime(2026, 1, 19, 10, 0, tzinfo=timezone.utc),
        duration_sec=3600,
        distance_m=12000
    )
    act_manual = Activity(metadata=meta_manual, streams=df)
    
    comment = "Excellent feeling! #split:0-5km,5-12km"
    res_manual = calc.compute(act_manual, profile, nolio_comment=comment)
    
    seg_m = res_manual['segmented_metrics']
    print(f"Segmentation Type: {seg_m.segmentation_type}")
    print(f"Manual Splits: {list(seg_m.manual.keys())}")
    for label, data in seg_m.manual.items():
        print(f"  • {label}: HR={data.hr:.1f}, Speed={data.speed:.1f}km/h, Ratio={data.ratio:.3f}")

if __name__ == "__main__":
    test_smart_segmentation()