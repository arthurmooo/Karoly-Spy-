import pytest
from unittest.mock import MagicMock, patch
import scripts.run_ingest
from datetime import datetime, timezone

def test_ingestion_robot_wires_calculator():
    """
    Verifies that IngestionRobot uses ReadinessCalculator to update baselines.
    """
    with patch('scripts.run_ingest.DBConnector') as mock_db_class, \
         patch('scripts.run_ingest.NolioClient') as mock_nolio_class, \
         patch('scripts.run_ingest.StorageManager'), \
         patch('scripts.run_ingest.WeatherClient'), \
         patch('scripts.run_ingest.AthleteConfig'), \
         patch('scripts.run_ingest.ProfileManager'), \
         patch('scripts.run_ingest.ActivityClassifier'), \
         patch('scripts.run_ingest.NolioPlanParser'), \
         patch('scripts.run_ingest.ReadinessCalculator') as mock_calc_class:
        
        # Setup mock instances
        mock_db = mock_db_class.return_value
        mock_nolio = mock_nolio_class.return_value
        mock_calc = mock_calc_class.return_value
        
        # Mock managed athletes
        mock_nolio.get_managed_athletes.return_value = [
            {"nolio_id": 1824, "name": "Estelle-Marie Kieffer"}
        ]
        
        # Mock DB response for athlete existence
        mock_table = MagicMock()
        mock_db.client.table.return_value = mock_table
        mock_execute = MagicMock()
        mock_execute.data = [{"id": "uuid-estelle"}]
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_execute
        
        # Mock health data sync (at least one entry to trigger baseline calculation)
        mock_nolio.get_athlete_health_metrics.return_value = {"2026-01-22": {}}
        
        # Mock baseline calculation result
        mock_calc.calculate_baselines.return_value = {
            "rmssd_30d_avg": 65.0,
            "resting_hr_30d_avg": 48.0
        }

        # Instantiate Robot
        robot = scripts.run_ingest.IngestionRobot()
        
        # Run roster sync
        robot.sync_athletes_roster(force_metrics=True)
        
        # Verify ReadinessCalculator was called
        mock_calc.calculate_baselines.assert_called_once()
        
        # Verify that baselines were upserted to DB
        # Check if table("daily_readiness") was called for baseline update
        mock_db.client.table.assert_any_call("daily_readiness")
        
        # Find the call that contains rmssd_30d_avg
        baseline_upsert_called = False
        for call in mock_table.upsert.call_args_list:
            args, _ = call
            if "rmssd_30d_avg" in args[0]:
                baseline_upsert_called = True
                assert args[0]["rmssd_30d_avg"] == 65.0
                assert args[0]["resting_hr_30d_avg"] == 48.0
        
        assert baseline_upsert_called, "Baseline upsert was not called with expected data"
