import pytest
from unittest.mock import MagicMock, patch
import scripts.run_ingest

def test_sync_athletes_roster_triggers_health():
    """
    Verifies that health metrics sync is called for each athlete.
    """
    with patch('scripts.run_ingest.DBConnector') as mock_db_class, \
         patch('scripts.run_ingest.NolioClient') as mock_nolio_class, \
         patch('scripts.run_ingest.StorageManager'), \
         patch('scripts.run_ingest.WeatherClient'), \
         patch('scripts.run_ingest.AthleteConfig'), \
         patch('scripts.run_ingest.ProfileManager'), \
         patch('scripts.run_ingest.ActivityClassifier'), \
         patch('scripts.run_ingest.NolioPlanParser'):
        
        # Setup mock instances
        mock_db = mock_db_class.return_value
        mock_nolio = mock_nolio_class.return_value
        
        # Mock managed athletes
        mock_nolio.get_managed_athletes.return_value = [
            {"nolio_id": 1824, "name": "Estelle-Marie Kieffer"}
        ]
        
        # Mock DB response for athlete existence
        mock_table = MagicMock()
        mock_db.client.table.return_value = mock_table
        
        # We need to mock the chain: table().select().eq().execute().data
        mock_execute = MagicMock()
        mock_execute.data = [{"id": "uuid-estelle"}]
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_execute
        
        # Mock health data from Nolio
        mock_health_data = {
            "2026-01-22": {"rmssd": 72.5, "resting_hr": 45.0, "sleep_duration": 8.0, "sleep_score": 85.0}
        }
        mock_nolio.get_athlete_health_metrics.return_value = mock_health_data
        # Ensure it doesn't fail on profile sync either
        mock_nolio.get_athlete_metrics.return_value = {}

        # Instantiate Robot (it will use the mocked classes patched in scripts.run_ingest)
        robot = scripts.run_ingest.IngestionRobot()
        
        # Force metrics/health sync
        robot.sync_athletes_roster(force_metrics=True)
        
        # Check if get_athlete_health_metrics was called
        mock_nolio.get_athlete_health_metrics.assert_called_once_with(1824, days=14)
        
        # Check if daily_readiness table was updated
        mock_db.client.table.assert_any_call("daily_readiness")
        assert mock_table.upsert.called
        
        args, kwargs = mock_table.upsert.call_args
        upsert_data = args[0]
        assert upsert_data["athlete_id"] == "uuid-estelle"
        assert upsert_data["rmssd"] == 72.5
        assert upsert_data["resting_hr"] == 45.0
