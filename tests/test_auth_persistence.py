
import os
import unittest
from unittest.mock import patch, MagicMock
from projectk_core.auth.nolio_auth import NolioAuthenticator

class TestAuthPersistence(unittest.TestCase):
    def setUp(self):
        # Create a dummy .env file
        self.test_env_path = "tests/.env.test"
        with open(self.test_env_path, "w") as f:
            f.write("NOLIO_CLIENT_ID=test_id\n")
            f.write("NOLIO_CLIENT_SECRET=test_secret\n")
            f.write("NOLIO_REFRESH_TOKEN=OLD_TOKEN_XYZ\n")
            f.write("OTHER_VAR=keep_me\n")

    def tearDown(self):
        # Cleanup
        if os.path.exists(self.test_env_path):
            os.remove(self.test_env_path)

    @patch('requests.post')
    def test_refresh_token_updates_env_file(self, mock_post):
        # Setup Mock Response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "NEW_ACCESS_TOKEN",
            "refresh_token": "NEW_REFRESH_TOKEN_123", # <--- This should be saved
            "expires_in": 3600
        }
        mock_post.return_value = mock_response

        # Init Auth with test env
        auth = NolioAuthenticator(
            client_id="test_id", 
            client_secret="test_secret",
            env_path=self.test_env_path
        )
        
        # Override the in-memory token to match file (usually loaded from env vars, but we want to test the class logic)
        auth.refresh_token = "OLD_TOKEN_XYZ"

        # Action
        auth.refresh_access_token()

        # Assertion
        with open(self.test_env_path, "r") as f:
            content = f.read()
        
        print("DEBUG: Test Env Content:\n" + content)
        
        self.assertIn("NOLIO_REFRESH_TOKEN=NEW_REFRESH_TOKEN_123", content)
        self.assertNotIn("OLD_TOKEN_XYZ", content)
        self.assertIn("OTHER_VAR=keep_me", content)

if __name__ == '__main__':
    unittest.main()
