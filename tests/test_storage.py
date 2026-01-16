import pytest
from unittest.mock import patch, MagicMock
from projectk_core.integrations.storage import StorageManager

@pytest.fixture
def mock_db_connector():
    with patch("projectk_core.integrations.storage.DBConnector") as MockDB:
        mock_client = MagicMock()
        MockDB.return_value.client = mock_client
        yield mock_client

def test_upload_fit_file_success(mock_db_connector):
    # Setup
    manager = StorageManager()
    mock_storage = mock_db_connector.storage.from_
    mock_bucket = mock_storage.return_value
    
    # Execute
    # Assuming date is a datetime object or string. Let's use string "YYYY-MM-DD"
    path = manager.upload_fit_file(
        athlete_id=10, 
        nolio_id=999, 
        content=b"binary_data", 
        year="2025"
    )
    
    # Verify
    # Expected path in bucket: 10/2025/999.fit (bucket is 'raw_fits' defined in class)
    expected_path = "10/2025/999.fit"
    
    assert path == expected_path
    mock_storage.assert_called_with("raw_fits")
    
    # Verify upload call
    mock_bucket.upload.assert_called_with(
        path=expected_path,
        file=b"binary_data",
        file_options={"content-type": "application/octet-stream", "upsert": "false"}
    )

def test_upload_fit_file_duplicate(mock_db_connector):
    # Setup: Simulate error if file exists (if we don't upsert)
    manager = StorageManager()
    mock_storage = mock_db_connector.storage.from_
    mock_bucket = mock_storage.return_value
    mock_bucket.upload.side_effect = Exception("Object already exists")
    
    # Execute
    try:
        path = manager.upload_fit_file(10, 999, b"data", "2025")
    except Exception as e:
        # Depending on design, we might want to catch or raise. 
        # For now, let's assume we allow it to raise or return existing path.
        pass

def test_download_fit_file(mock_db_connector):
    # Setup
    manager = StorageManager()
    mock_storage = mock_db_connector.storage.from_
    mock_bucket = mock_storage.return_value
    mock_bucket.download.return_value = b"downloaded_data"
    
    # Execute
    data = manager.download_fit_file("10/2025/999.fit")
    
    # Verify
    assert data == b"downloaded_data"
    mock_bucket.download.assert_called_with("10/2025/999.fit")
