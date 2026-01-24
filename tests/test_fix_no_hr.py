
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.processing.calculator import MetricsCalculator

class MockConfig:
    def get(self, key, default):
        return default

def test_compute_metrics_no_heart_rate():
    """
    Vérifie que le calculateur ne crash pas si heart_rate est absente.
    """
    seconds = 600
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='s'),
        'speed': [5.0] * seconds, # 5 m/s
        'power': [0.0] * seconds
    })

    meta = ActivityMetadata(
        activity_type="Run",
        start_time=datetime(2024, 1, 1),
        duration_sec=seconds,
        distance_m=3000.0
    )
    activity = Activity(metadata=meta, streams=df)
    
    # Profile avec CP pour calcul MLS via vitesse
    profile = PhysioProfile(
        valid_from=datetime(2024, 1, 1),
        cp_cs=4.0, # CP à 4 m/s
        lt1_hr=140,
        lt2_hr=160
    )

    calc = MetricsCalculator(MockConfig())
    # Ne doit pas lever de KeyError: 'heart_rate'
    result = calc.compute(activity, profile)
    
    assert "mls_load" in result
    assert result["mls_load"] is not None
    print("✅ Test no heart_rate passed!")

if __name__ == "__main__":
    test_compute_metrics_no_heart_rate()
