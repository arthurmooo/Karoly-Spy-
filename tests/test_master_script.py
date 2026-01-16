import pytest
from unittest.mock import patch, MagicMock
from run_k import main
import sys
from projectk_core.logic.reprocessor import ReprocessingEngine

# --- CLI TESTS ---

def test_cli_help(capsys):
    with patch.object(sys, 'argv', ['run_k.py', '--help']):
        with pytest.raises(SystemExit) as e:
            main()
        assert e.value.code == 0
        captured = capsys.readouterr()
        assert "Available commands" in captured.out

@patch("scripts.run_ingest.IngestionRobot")
def test_cli_ingest_call(mock_robot, capsys):
    with patch.object(sys, 'argv', ['run_k.py', 'ingest', '--days', '5', '--athlete', 'Adrien']):
        main()
        mock_robot.assert_called_once_with(history_days=5)
        mock_robot.return_value.run.assert_called_once_with(specific_athlete_name="Adrien")

@patch("projectk_core.logic.reprocessor.ReprocessingEngine")
def test_cli_reprocess_call(mock_engine):
    with patch.object(sys, 'argv', ['run_k.py', 'reprocess', '--athlete', 'Karoly', '--force']):
        main()
        mock_engine.return_value.run.assert_called_once_with(athlete_name_filter="Karoly", force=True)

# --- REPROCESSOR LOGIC TESTS ---

@pytest.fixture
def mock_repro_deps():
    with patch("projectk_core.logic.reprocessor.DBConnector") as MockDB, \
         patch("projectk_core.logic.reprocessor.StorageManager") as MockStorage, \
         patch("projectk_core.logic.reprocessor.FitParser") as MockParser, \
         patch("projectk_core.logic.reprocessor.MetricsCalculator") as MockCalc, \
         patch("projectk_core.logic.reprocessor.ProfileManager") as MockProfile, \
         patch("projectk_core.logic.reprocessor.ActivityWriter") as MockWriter:
        
        mock_client = MagicMock()
        MockDB.return_value.client = mock_client
        
        yield {
            "db": MockDB,
            "client": mock_client,
            "storage": MockStorage,
            "parser": MockParser,
            "calc": MockCalc,
            "profile": MockProfile,
            "writer": MockWriter
        }

def test_reprocessor_run_flow(mock_repro_deps):
    # 1. Mock Athletes query
    mock_query = MagicMock()
    mock_repro_deps["client"].table.return_value.select.return_value = mock_query
    
    # Success data for .execute() and .ilike().execute()
    mock_data = MagicMock()
    mock_data.data = [{"id": "uuid-1", "first_name": "Test", "last_name": "User"}]
    mock_query.execute.return_value = mock_data
    mock_query.ilike.return_value.execute.return_value = mock_data
    
    # 2. Mock Activities query
    mock_act_query = MagicMock()
    # Note: we need to distinguish between table("athletes") and table("activities")
    def table_side_effect(table_name):
        if table_name == "athletes":
            return mock_repro_deps["client"].table.return_value # the one with select
        return mock_act_query # for activities
        
    mock_repro_deps["client"].table.side_effect = table_side_effect
    
    mock_act_data = MagicMock()
    mock_act_data.data = [{"id": 1, "nolio_id": "n1", "fit_file_path": "p/f.fit", "sport_type": "Bike", "session_date": "2023-01-01T10:00:00", "rpe": 5}]
    mock_act_query.select.return_value.eq.return_value.not_.is_.return_value.execute.return_value = mock_act_data
    
    # 3. Mock Storage download
    mock_repro_deps["storage"].return_value.download_fit_file.return_value = b"fit_data"
    
    # 4. Mock Parser
    mock_df = MagicMock()
    mock_df.empty = False
    mock_df.__len__.return_value = 1000
    mock_series = MagicMock()
    mock_series.iloc.__getitem__.return_value = "2023-01-01"
    mock_df.__getitem__.return_value = mock_series
    mock_repro_deps["parser"].parse.return_value = (mock_df, {}, [])
    
    # 5. Mock Profile
    mock_repro_deps["profile"].return_value.get_profile_for_date.return_value = {"id": "prof-1"}
    
    # 6. Mock Calc
    mock_repro_deps["calc"].return_value.compute.return_value = {"mls_load": 100}

    # Execute
    engine = ReprocessingEngine()
    engine.run(athlete_name_filter="Test")
    
    # Verify
    mock_repro_deps["storage"].return_value.download_fit_file.assert_called_with("p/f.fit")
    mock_repro_deps["writer"].save.assert_called_once()

def test_reprocessor_missing_file_handling(mock_repro_deps, capsys):
    engine = ReprocessingEngine()
    
    # Mock athlete found
    mock_repro_deps["db"].return_value.client.table.return_value.select.return_value.execute.return_value.data = [{"id": "u1", "first_name": "A", "last_name": "B"}]
    
    # Mock activity found but file missing in storage
    mock_repro_deps["db"].return_value.client.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.execute.return_value.data = [{"id": 1, "fit_file_path": "missing.fit", "session_date": "2023-01-01", "sport_type": "Run", "nolio_id": "n1"}]
    mock_repro_deps["storage"].return_value.download_fit_file.return_value = None
    
    # Execute
    engine.run()
    
    # Verify warning printed but no crash
    captured = capsys.readouterr()
    assert "File not found in storage" in captured.out
