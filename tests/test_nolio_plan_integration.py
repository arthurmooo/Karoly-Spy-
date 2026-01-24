import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime
from projectk_core.integrations.nolio import NolioClient

class TestNolioPlanIntegration(unittest.TestCase):
    
    def setUp(self):
        self.client = NolioClient()
        self.client.auth = MagicMock()
        self.client.auth.get_valid_token.return_value = "fake_token"

    @patch('requests.get')
    def test_get_planned_workout_by_id(self, mock_get):
        # Mock successful response for get_planned_workout
        # It returns a LIST containing the workout
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Reflecting real structure found: nolio_id, structured_workout
        mock_response.json.return_value = [{
            "nolio_id": 123, 
            "structured_workout": [{"step_duration_type": "duration"}]
        }]
        mock_get.return_value = mock_response

        # Test valid ID
        result = self.client.get_planned_workout_by_id(123)
        self.assertIsNotNone(result)
        self.assertEqual(result.get("structured_workout"), [{"step_duration_type": "duration"}])
        
        # Verify URL and Params
        mock_get.assert_called_with(
            "https://www.nolio.io/api/get/planned/training/", 
            headers={"Authorization": "Bearer fake_token", "Accept": "application/json"},
            params={"id": 123}
        )

    @patch('requests.get')
    def test_find_planned_workout_logic(self, mock_get):
        # Mock list response for range query
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Reflecting real structure
        mock_response.json.return_value = [
            {"nolio_id": 101, "name": "10x30/30", "date_start": "2026-01-15", "structured_workout": []},
            {"nolio_id": 102, "name": "Endurance", "date_start": "2026-01-16", "structured_workout": []}
        ]
        mock_get.return_value = mock_response

        # Test Finding "10x30" around 2026-01-15
        target_date = datetime(2026, 1, 15)
        result = self.client.find_planned_workout("athlete_1", target_date, "10x30")
        
        self.assertIsNotNone(result)
        self.assertEqual(result["nolio_id"], 101)
        
        # Verify params have date range
        args, kwargs = mock_get.call_args
        self.assertIn("from", kwargs['params'])
        self.assertIn("to", kwargs['params'])
        self.assertEqual(kwargs['params']['athlete_id'], "athlete_1")

if __name__ == '__main__':
    unittest.main()