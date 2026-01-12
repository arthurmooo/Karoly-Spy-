import pytest
import pandas as pd
import numpy as np
import sys
import os
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile, Athlete
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.processing.calculator import MetricsCalculator

# Mock config pour le test
class MockConfig:
    def get(self, key, default=0.0):
        defaults = {
            'alpha_load_hr': 0.5,
            'beta_load_power': 1.0, # Pas utilisé dans la formule "Karoly MLS" brute mais bon
            'drift_threshold_percent': 3.0,
            'beta_dur': 0.08
            # bins et factors sont souvent hardcodés ou complexes à mocker via get simple, 
            # je vais assumer qu'ils sont des constantes de classe ou passés autrement.
            # Dans mon implémentation, je vais les mettre en constantes ou config JSON.
        }
        return defaults.get(key, default)

@pytest.fixture
def basic_physio_profile():
    return PhysioProfile(
        lt1_hr=140, lt2_hr=160,
        cp=300, valid_from=datetime(2024, 1, 1)
    )

def test_mls_calculation_steady_state(basic_physio_profile):
    """
    Test avec une activité stable parfaite.
    Power = 200W (CP=300 -> IF=0.66 -> f_int=0.8)
    HR = 150bpm (Zone 2: 140-160 -> 100% time -> INT=1.5)
    Durée = 3600s
    Drift = 0 -> DUR=1
    
    Energy = 720 kJ
    MEC = 720 * 0.8 = 576
    MLS = 576 * 1.5 * 1 = 864
    """
    # Création des données synthétiques
    seconds = 3600
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='S'),
        'power': [200.0] * seconds,
        'heart_rate': [150.0] * seconds,
        'speed': [0.0] * seconds, # Non utilisé pour vélo avec power
        'cadence': [90] * seconds
    })
    
    meta = ActivityMetadata(
        activity_type="Ride", # Important pour trigger logic vélo
        start_time=datetime(2024, 1, 1),
        duration_sec=seconds
    )
    
    activity = Activity(metadata=meta, streams=df)
    
    # Calcul
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    
    # Assertions
    assert result['energy_kj'] == 720.0
    assert result['intensity_factor'] == pytest.approx(0.666, 0.01)
    # assert result['f_int'] == 0.8 # Si exposé
    assert result['mec'] == pytest.approx(576.0, 0.1)
    assert result['int_index'] == 1.5
    assert result['dur_index'] == 1.0
    assert result['mls_load'] == pytest.approx(864.0, 1.0)

def test_pahr_drift_calculation(basic_physio_profile):
    """
    Test du calcul de drift.
    1ère moitié: Power 200, HR 140 -> Ratio 1.428
    2ème moitié: Power 200, HR 154 -> Ratio 1.298
    Drift = (1.298 / 1.428) - 1 = -0.09 (-9%)
    Abs Drift = 9%
    Threshold = 3%
    Penalty = 9 - 3 = 6%
    DUR = 1 + 0.08 * 6 = 1.48
    """
    seconds = 3600
    mid = seconds // 2
    
    power = [200.0] * seconds
    # HR augmente en 2eme partie (dérive cardiaque)
    hr = [140.0] * mid + [154.0] * mid
    
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='S'),
        'power': power,
        'heart_rate': hr,
        'speed': [0.0] * seconds,
        'cadence': [90] * seconds
    })
    
    meta = ActivityMetadata(
        activity_type="Ride",
        start_time=datetime(2024, 1, 1),
        duration_sec=seconds
    )
    activity = Activity(metadata=meta, streams=df)
    
    calc = MetricsCalculator(MockConfig())
    result = calc.compute(activity, basic_physio_profile)
    
    assert result['drift_pahr_percent'] == pytest.approx(-9.1, 0.2) # approx 130/143 vs 143/140...
    # Vérifions le calcul exact :
    # P1/H1 = 200/140 = 1.4285
    # P2/H2 = 200/154 = 1.2987
    # Drift = (1.2987 / 1.4285) - 1 = 0.909 - 1 = -0.0909 (-9.09%)
    
    drift_abs_excess = 9.09 - 3.0 # 6.09
    expected_dur = 1 + 0.08 * drift_abs_excess # 1 + 0.487 = 1.487
    
    assert result['dur_index'] == pytest.approx(expected_dur, 0.01)

