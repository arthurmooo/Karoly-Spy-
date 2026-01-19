
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
        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"id": 123, "structure": {"type": "repetition"}}]
        mock_get.return_value = mock_response

        # Test valid ID
        result = self.client.get_planned_workout_by_id(123)
        self.assertIsNotNone(result)
        self.assertEqual(result.get("structure"), {"type": "repetition"})
        
        # Verify URL and Params (We expect it to use the new endpoint logic if needed or existing one)
        # Based on previous exploration, we know /get/planned/training/ works with ID
        mock_get.assert_called_with(
            "https://www.nolio.io/api/get/planned/training/", 
            headers={"Authorization": "Bearer fake_token", "Accept": "application/json"},
            params={"id": 123}
        )

    @patch('requests.get')
    def test_find_planned_workout_fallback(self, mock_get):
        # Mock list response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"nolio_id": 101, "name": "10x30/30", "date_start": "2026-01-15"},
            {"nolio_id": 102, "name": "Endurance", "date_start": "2026-01-16"}
        ]
        mock_get.return_value = mock_response

        # Test Finding "10x30" around 2026-01-15
        target_date = datetime(2026, 1, 15)
        result = self.client.find_planned_workout("athlete_1", target_date, "10x30")
        
        self.assertIsNotNone(result)
        self.assertEqual(result["nolio_id"], 101)
        
        # Verify it searched a range (Same Week logic)
        # We expect the client to define the range
        args, kwargs = mock_get.call_args
        self.assertIn("from", kwargs['params'])
        self.assertIn("to", kwargs['params'])

if __name__ == '__main__':
    unittest.main()
