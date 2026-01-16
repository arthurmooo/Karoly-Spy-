import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from scripts.run_ingest import IngestionRobot

@pytest.fixture
def mock_deps():
    with patch("scripts.run_ingest.DBConnector") as MockDB, \
         patch("scripts.run_ingest.NolioClient") as MockNolio, \
         patch("scripts.run_ingest.StorageManager") as MockStorage, \
         patch("scripts.run_ingest.AthleteConfig") as MockConfig, \
         patch("scripts.run_ingest.MetricsCalculator") as MockCalc, \
         patch("scripts.run_ingest.ProfileManager") as MockProfile, \
         patch("scripts.run_ingest.ActivityWriter") as MockWriter, \
         patch("scripts.run_ingest.FitParser") as MockParser:
        
        yield {
            "db": MockDB,
            "nolio": MockNolio,
            "storage": MockStorage,
            "config": MockConfig,
            "calc": MockCalc,
            "profile": MockProfile,
            "writer": MockWriter,
            "parser": MockParser
        }

def test_sync_athletes_roster(mock_deps):
    # Setup
    robot = IngestionRobot()
    mock_deps["nolio"].return_value.get_managed_athletes.return_value = [
        {"id": 100, "first_name": "John", "last_name": "Doe", "email": "j@d.com"}
    ]
    # DB mock: select returns empty (new athlete)
    mock_deps["db"].return_value.client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    
    # Execute
    robot.sync_athletes_roster()
    
    # Verify insert called
    mock_deps["db"].return_value.client.table.return_value.insert.assert_called_once()
    args = mock_deps["db"].return_value.client.table.return_value.insert.call_args[0][0]
    assert args["nolio_id"] == 100
    assert args["first_name"] == "John"

def test_process_activity_flow(mock_deps):
    # Setup
    robot = IngestionRobot()
    athlete_id = "uuid-123"
    nolio_act = {
        "id": 999,
        "nolio_id": 999,
        "name": "Test Run",
        "file_url": "http://url.fit",
        "sport": "Run",
        "date_start": "2023-01-01T10:00:00Z",
        "rpe": 5
    }
    
    # Mock download success
    mock_deps["nolio"].return_value.download_fit_file.return_value = b"fit_content"
    
    # Mock DB checks (no duplicates)
    mock_deps["db"].return_value.client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    
    # Mock Parser
    mock_df = MagicMock()
    mock_df.empty = False
    mock_df.__len__.return_value = 3600
    
    # Mock timestamp access for start date extraction
    # We need to ensure df['timestamp'].iloc[0] works
    mock_series = MagicMock()
    mock_series.iloc.__getitem__.return_value = datetime(2023, 1, 1)
    mock_df.__getitem__.return_value = mock_series
    
    mock_deps["parser"].parse.return_value = (mock_df, {"serial_number": "SN123"}, [])
    
    # Mock Storage upload path
    mock_deps["storage"].return_value.upload_fit_file.return_value = "path/to/file.fit"

    # Execute
    robot.process_activity(athlete_id, nolio_act)
    
    # Verify Storage Upload
    mock_deps["storage"].return_value.upload_fit_file.assert_called_once()
    
    # Verify DB Save
    mock_deps["writer"].save.assert_called_once()
