import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock
try:
    from projectk_core.processing.readiness import ReadinessCalculator
except ImportError:
    ReadinessCalculator = None

def test_calculate_baselines_basic():
    """
    Verifies that the calculator correctly computes 30-day averages.
    """
    if ReadinessCalculator is None:
        pytest.fail("ReadinessCalculator not implemented")
        
    mock_db = MagicMock()
    # Mock return of 30 days of data
    athlete_id = "uuid-test"
    base_date = date(2026, 1, 22)
    
    mock_data = []
    for i in range(30):
        mock_data.append({
            "athlete_id": athlete_id,
            "date": (base_date - timedelta(days=i)).isoformat(),
            "rmssd": 60.0 + (i % 5), # 60, 61, 62, 63, 64...
            "resting_hr": 50.0
        })
    
    # Mock DB response
    mock_execute = MagicMock()
    mock_execute.data = mock_data
    mock_db.client.table().select().eq().lte().order().limit().execute.return_value = mock_execute
    
    calc = ReadinessCalculator(mock_db)
    baselines = calc.calculate_baselines(athlete_id, base_date)
    
    # Average of 60, 61, 62, 63, 64 is 62.0
    assert baselines["rmssd_30d_avg"] == 62.0
    assert baselines["resting_hr_30d_avg"] == 50.0

def test_calculate_baselines_missing_data():
    """
    Verifies that the calculator handles missing days correctly.
    """
    if ReadinessCalculator is None:
        pytest.fail("ReadinessCalculator not implemented")
        
    mock_db = MagicMock()
    # Only 5 days of data
    mock_data = [{"rmssd": 70.0, "resting_hr": 40.0} for _ in range(5)]
    
    mock_execute = MagicMock()
    mock_execute.data = mock_data
    mock_db.client.table().select().eq().lte().order().limit().execute.return_value = mock_execute
    
    calc = ReadinessCalculator(mock_db)
    baselines = calc.calculate_baselines("uuid-test", date.today())
    
    assert baselines["rmssd_30d_avg"] == 70.0
    assert baselines["resting_hr_30d_avg"] == 40.0
