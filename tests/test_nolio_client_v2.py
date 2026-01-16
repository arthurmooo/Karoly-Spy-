import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from projectk_core.integrations.nolio import NolioClient

@pytest.fixture
def mock_authenticator():
    with patch("projectk_core.integrations.nolio.NolioAuthenticator") as MockAuth:
        instance = MockAuth.return_value
        instance.get_valid_token.return_value = "fake_token"
        yield instance

@pytest.fixture
def client(mock_authenticator):
    return NolioClient()

@patch("requests.get")
def test_get_managed_athletes_success(mock_get, client):
    # Setup
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"id": 1, "name": "Athlete 1"}]
    mock_get.return_value = mock_response

    # Execute
    athletes = client.get_managed_athletes()

    # Verify
    assert len(athletes) == 1
    assert athletes[0]["id"] == 1
    mock_get.assert_called_with(
        "https://www.nolio.io/api/get/athletes/",
        headers={"Authorization": "Bearer fake_token", "Accept": "application/json"}
    )

@patch("requests.get")
def test_get_activities_success(mock_get, client):
    # Setup
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"id": 101, "type": "Run"}]
    mock_get.return_value = mock_response

    # Execute
    activities = client.get_activities(athlete_id=123, date_from="2023-01-01", date_to="2023-01-07")

    # Verify
    assert len(activities) == 1
    mock_get.assert_called_with(
        "https://www.nolio.io/api/get/training/",
        headers={"Authorization": "Bearer fake_token", "Accept": "application/json"},
        params={"athlete_id": 123, "from": "2023-01-01", "to": "2023-01-07", "limit": 50}
    )

@patch("requests.get")
@patch("time.sleep")
def test_rate_limit_retry(mock_sleep, mock_get, client):
    # Setup: First call 429, Second call 200
    response_429 = MagicMock()
    response_429.status_code = 429
    
    response_200 = MagicMock()
    response_200.status_code = 200
    response_200.json.return_value = []

    mock_get.side_effect = [response_429, response_200]

    # Execute
    client.get_managed_athletes()

    # Verify
    assert mock_get.call_count == 2
    mock_sleep.assert_called_with(60)

@patch("requests.get")
def test_download_fit_file_success(mock_get, client):
    # Setup
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fit_data"
    mock_get.return_value = mock_response

    # Execute
    data = client.download_fit_file("http://example.com/file.fit")

    # Verify
    assert data == b"fit_data"

@patch("requests.get")
@patch("time.sleep")
def test_download_fit_file_failure(mock_sleep, mock_get, client):
    # Setup
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.raise_for_status.side_effect = Exception("Not Found")
    mock_get.return_value = mock_response

    # Execute
    data = client.download_fit_file("http://example.com/missing.fit")

    # Verify
    assert data is None
    # Verify it retried 3 times and slept twice
    assert mock_get.call_count == 3
    assert mock_sleep.call_count == 2

@patch("requests.get")
@patch("time.sleep")
def test_download_fit_file_retry_success(mock_sleep, mock_get, client):
    # Setup: Fail twice, then succeed
    fail_response = MagicMock()
    fail_response.raise_for_status.side_effect = Exception("Network Error")
    
    success_response = MagicMock()
    success_response.status_code = 200
    success_response.content = b"fit_data"
    
    mock_get.side_effect = [fail_response, fail_response, success_response]
    
    # Execute
    data = client.download_fit_file("http://example.com/retry.fit")
    
    # Verify
    assert data == b"fit_data"
    assert mock_get.call_count == 3
    assert mock_sleep.call_count == 2
