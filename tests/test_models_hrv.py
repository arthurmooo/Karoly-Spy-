import pytest
from datetime import date
from pydantic import ValidationError
try:
    from projectk_core.logic.models import DailyReadiness
except ImportError:
    # This is expected to fail initially in TDD if not implemented
    DailyReadiness = None

def test_daily_readiness_model_instantiation():
    """
    Verifies that DailyReadiness can be instantiated with valid data.
    """
    if DailyReadiness is None:
        pytest.fail("DailyReadiness model not found in projectk_core.logic.models")
        
    data = {
        "athlete_id": "550e8400-e29b-41d4-a716-446655440000",
        "date": date(2026, 1, 22),
        "rmssd": 65.5,
        "resting_hr": 48.0,
        "sleep_duration": 7.5,
        "sleep_score": 85.0,
        "rmssd_30d_avg": 62.0,
        "resting_hr_30d_avg": 50.0
    }
    
    readiness = DailyReadiness(**data)
    assert readiness.athlete_id == data["athlete_id"]
    assert readiness.date == data["date"]
    assert readiness.rmssd == 65.5
    assert readiness.resting_hr == 48.0

def test_daily_readiness_optional_fields():
    """
    Verifies that optional fields can be None.
    """
    if DailyReadiness is None:
        pytest.fail("DailyReadiness model not found in projectk_core.logic.models")
        
    data = {
        "athlete_id": "550e8400-e29b-41d4-a716-446655440000",
        "date": date(2026, 1, 22)
    }
    
    readiness = DailyReadiness(**data)
    assert readiness.rmssd is None
    assert readiness.rmssd_30d_avg is None
