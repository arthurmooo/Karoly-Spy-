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
        cp_cs=300, valid_from=datetime(2024, 1, 1)
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


def test_multi_block_interval_summary_uses_primary_block(monkeypatch):
    seconds = 4000
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2026-02-07', periods=seconds, freq='s'),
        'speed': np.full(seconds, 4.5),
        'heart_rate': np.full(seconds, 160.0),
    })

    meta = ActivityMetadata(
        activity_type="Run",
        activity_name="5*1Km seuil + 9Km Tempo",
        start_time=datetime(2026, 2, 7),
        duration_sec=seconds,
    )
    activity = Activity(metadata=meta, streams=df, laps=[])

    profile = PhysioProfile(
        lt1_hr=140,
        lt2_hr=170,
        cp_cs=5.0,
        valid_from=datetime(2024, 1, 1),
    )

    calc = MetricsCalculator(MockConfig())
    calc.classifier.detect_work_type = lambda *args, **kwargs: "intervals"
    calc.classifier.get_strategy = lambda *args, **kwargs: "auto_training"

    detections = []
    short_speeds = [5.45, 5.52, 5.57, 5.60, 5.63]
    for i, spd in enumerate(short_speeds):
        detections.append({
            "status": "matched",
            "source": "lap",
            "confidence": 0.95,
            "target_index": i,
            "start_index": i * 200,
            "end_index": i * 200 + 180,
            "duration_sec": 180,
            "expected_duration": 184,
            "avg_power": None,
            "avg_speed": spd,
            "avg_hr": 165 + i,
            "respect_score": 105 + i,
            "target": {"type": "active", "duration": 184, "distance_m": 1000},
        })

    detections.append({
        "status": "matched",
        "source": "lap",
        "confidence": 0.95,
        "target_index": 5,
        "start_index": 1400,
        "end_index": 3160,
        "duration_sec": 1760,
        "expected_duration": 1780,
        "avg_power": None,
        "avg_speed": 5.10,
        "avg_hr": 176,
        "respect_score": 101,
        "target": {"type": "active", "duration": 1780, "distance_m": 9000},
    })

    calc.matcher.match = lambda *args, **kwargs: detections

    result = calc.compute(activity, profile, target_grid=[{"duration": 1}] * 6)
    blocks = result.get("interval_blocks") or []
    assert len(blocks) == 2
    assert blocks[0]["count"] == 5
    assert blocks[1]["count"] == 1
    # Legacy metrics should follow the primary block (5x1km), not the long tempo block.
    assert result["interval_pace_last"] == pytest.approx(2.96, 0.05)


def test_prune_leading_singleton_transition_block():
    calc = MetricsCalculator(MockConfig())
    entries = [
        {"order": 0, "duration_sec": 322, "target_duration": 322, "target_distance": 1500, "avg_power": None, "avg_speed": 4.67, "avg_hr": 144, "respect_score": None},
        {"order": 1, "duration_sec": 182, "target_duration": 182, "target_distance": 1000, "avg_power": None, "avg_speed": 5.53, "avg_hr": 155, "respect_score": None},
        {"order": 2, "duration_sec": 181, "target_duration": 181, "target_distance": 1000, "avg_power": None, "avg_speed": 5.52, "avg_hr": 158, "respect_score": None},
        {"order": 3, "duration_sec": 180, "target_duration": 180, "target_distance": 1000, "avg_power": None, "avg_speed": 5.55, "avg_hr": 160, "respect_score": None},
        {"order": 4, "duration_sec": 179, "target_duration": 179, "target_distance": 1000, "avg_power": None, "avg_speed": 5.54, "avg_hr": 161, "respect_score": None},
        {"order": 5, "duration_sec": 181, "target_duration": 181, "target_distance": 1000, "avg_power": None, "avg_speed": 5.53, "avg_hr": 163, "respect_score": None},
        {"order": 6, "duration_sec": 1762, "target_duration": 1762, "target_distance": 9000, "avg_power": None, "avg_speed": 5.12, "avg_hr": 177, "respect_score": None},
    ]

    blocks = calc._group_and_summarize_interval_entries(entries, "run")
    assert len(blocks) == 2
    assert blocks[0]["count"] == 5
    assert blocks[0]["representative_distance_m"] == 1000.0
    assert blocks[1]["count"] == 1
    assert blocks[1]["representative_distance_m"] == 9000.0
