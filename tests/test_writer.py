import pytest
from datetime import datetime, timezone
import pandas as pd
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.db.writer import ActivityWriter

def test_activity_serialization():
    """Test la conversion d'une activité enrichie vers le format DB."""
    
    # Setup Activity
    meta = ActivityMetadata(
        activity_type="Run",
        start_time=datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
        duration_sec=3600,
        distance_m=10000,
        device_id="12345",
        rpe=7,
        work_type="endurance",
    )
    df = pd.DataFrame({'power': [200]*3600, 'heart_rate': [150]*3600})
    act = Activity(metadata=meta, streams=df)
    
    # Inject metrics (comme si le Calculator était passé par là)
    act.metrics = {
        "mls_load": 150.5,
        "dur_index": 1.1,
        "drift_pahr_percent": 2.5,
        "normalized_power": 210.0,
        "intensity_factor": 0.8,
        "load_components": {
            "external": {
                "duration_min": 60.0,
                "distance_km": 10.0,
                "intensity_ratio_avg": 0.8,
            },
            "internal": {
                "srpe_load": 420.0,
                "time_lt1_sec": 0.0,
                "time_between_lt1_lt2_sec": 3600.0,
                "time_gt_lt2_sec": 0.0,
            },
            "global": {
                "mls": 150.5,
            },
        },
        "form_analysis": {"version": "karo_pdf_2026_03_17", "decision": {"final": "stable"}},
        "planned_interval_blocks": [
            {
                "block_index": 1,
                "count": 20,
                "representative_duration_sec": 90.0,
                "representative_distance_m": None,
                "target_type": "speed",
                "target_min": 4.5673,
                "target_max": 5.0481,
                "planned_source": "nolio_structured_workout",
            }
        ],
        # MEC, INT, etc. ignorés par le schéma actuel
    }
    
    # Autres attributs que le writer doit gérer s'ils sont dans l'objet Activity ou Meta
    # Pour l'instant on passe nolio_id et athlete_id manuellement au writer ou via l'objet ?
    # Idéalement l'objet Activity devrait savoir à qui il appartient.
    # On va passer athlete_id et nolio_id à la méthode serialize.
    
    record = ActivityWriter.serialize(act, athlete_id="uuid-athlete", nolio_id="nolio-123", file_path="path/to.fit")
    
    assert record['athlete_id'] == "uuid-athlete"
    assert record['nolio_id'] == "nolio-123"
    assert record['session_date'] == "2024-01-01T10:00:00+00:00"
    assert record['sport_type'] == "Run"
    assert record['load_index'] == 150.5
    assert record['durability_index'] == 1.1
    assert record['decoupling_index'] == 2.5
    assert record['avg_power'] == 200.0 # Moyenne du stream
    assert record['avg_hr'] == 150.0
    assert record['fit_file_path'] == "path/to.fit"
    assert record['rpe'] == 7
    assert record['work_type'] == "endurance"
    assert record['manual_work_type'] is None
    assert record['detected_work_type'] == "endurance"
    assert record['analysis_dirty'] is False
    assert record['load_components']['external']['duration_min'] == 60.0
    assert record['load_components']['internal']['srpe_load'] == 420.0
    assert record['load_components']['global']['mls'] == 150.5
    assert record['form_analysis']['version'] == "karo_pdf_2026_03_17"
    assert record['segmented_metrics']['planned_interval_blocks'][0]['count'] == 20
    assert record['segmented_metrics']['interval_blocks'] == []
