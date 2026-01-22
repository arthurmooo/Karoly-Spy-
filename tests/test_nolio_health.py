import pytest
from unittest.mock import MagicMock, patch
from projectk_core.integrations.nolio import NolioClient

@pytest.fixture
def mock_nolio_response():
    return {
        "rmssd": {
            "unit": "ms",
            "data": [
                {"date": "2026-01-22", "value": 72.5},
                {"date": "2026-01-21", "value": 68.0}
            ]
        },
        "hrrest": {
            "unit": "bpm",
            "data": [
                {"date": "2026-01-22", "value": 45.0},
                {"date": "2026-01-21", "value": 46.0}
            ]
        },
        "sleep": {
            "unit": "seconds",
            "data": [
                {"date": "2026-01-22", "value": 28800.0},
                {"date": "2026-01-21", "value": 27000.0}
            ]
        },
        "sleep_score": {
            "unit": "score",
            "data": [
                {"date": "2026-01-22", "value": 85.0}
            ]
        }
    }

def test_get_athlete_health_metrics_parsing(mock_nolio_response):
    """
    Verifies that get_athlete_health_metrics correctly parses the Nolio meta response.
    """
    client = NolioClient()
    
    with patch('requests.get') as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_nolio_response
        mock_get.return_value = mock_response
        
        # Test fetching last 2 days
        metrics = client.get_athlete_health_metrics(athlete_id=123, days=2)
        
        # Check if the result is a dict indexed by date
        assert "2026-01-22" in metrics
        assert "2026-01-21" in metrics
        
        day_22 = metrics["2026-01-22"]
        assert day_22["rmssd"] == 72.5
        assert day_22["resting_hr"] == 45.0
        assert day_22["sleep_duration"] == 8.0 # 28800 / 3600
        assert day_22["sleep_score"] == 85.0
        
        day_21 = metrics["2026-01-21"]
        assert day_21["rmssd"] == 68.0
        assert day_21["sleep_duration"] == 7.5 # 27000 / 3600
        assert day_21["sleep_score"] is None # Not present in mock for this day
