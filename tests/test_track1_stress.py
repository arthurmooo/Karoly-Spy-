import pytest
import os
import pandas as pd
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from projectk_core.db.connector import DBConnector
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.integrations.weather import WeatherClient
from projectk_core.integrations.nolio import NolioClient

@pytest.fixture
def db():
    return DBConnector()

def test_database_schema_integrity(db):
    """STRESS TEST: Verify all tables and critical columns exist."""
    tables_to_check = {
        "athletes": ["id", "first_name", "last_name", "nolio_id", "is_active"],
        "athlete_devices": ["id", "athlete_id", "serial_number"],
        "physio_profiles": ["id", "athlete_id", "sport", "lt1_hr", "lt2_hr", "valid_from", "valid_to"],
        "activities": ["id", "athlete_id", "nolio_id", "session_date", "sport_type", "load_index"]
    }
    
    for table, columns in tables_to_check.items():
        # Fetch one row (or empty result) to check columns
        res = db.client.table(table).select("*").limit(0).execute()
        # res.data will be an empty list, but if columns don't exist, it would crash or fail
        assert res is not None
        # Verify columns are in the metadata or just try to select them
        for col in columns:
            check_col = db.client.table(table).select(col).limit(0).execute()
            assert check_col is not None, f"Column {col} missing in table {table}"

def test_profile_manager_edge_cases(db):
    """STRESS TEST: Deep dive into SCD Type 2 logic boundaries."""
    pm = ProfileManager(db)
    
    athlete = db.client.table("athletes").insert({"first_name": "SCD", "last_name": "Edge"}).execute().data[0]
    aid = athlete["id"]
    
    try:
        # Create a timeline of profiles
        # P1: 2023-01-01 -> 2023-06-30
        # P2: 2023-07-01 -> ...
        db.client.table("physio_profiles").insert([
            {"athlete_id": aid, "sport": "run", "lt2_hr": 160, "valid_from": "2023-01-01T00:00:00+00:00", "valid_to": "2023-06-30T23:59:59+00:00"},
            {"athlete_id": aid, "sport": "run", "lt2_hr": 170, "valid_from": "2023-07-01T00:00:00+00:00", "valid_to": None}
        ]).execute()
        
        # Exact boundary start
        p_start = pm.get_profile_for_date(aid, "run", datetime(2023, 1, 1, tzinfo=timezone.utc))
        assert p_start["lt2_hr"] == 160
        
        # Exact boundary end
        p_end = pm.get_profile_for_date(aid, "run", datetime(2023, 6, 30, 23, 59, 58, tzinfo=timezone.utc))
        assert p_end["lt2_hr"] == 160
        
        # Switch date
        p_switch = pm.get_profile_for_date(aid, "run", datetime(2023, 7, 1, tzinfo=timezone.utc))
        assert p_switch["lt2_hr"] == 170
        
        # Date before any profile
        p_ancient = pm.get_profile_for_date(aid, "run", datetime(2022, 12, 31, tzinfo=timezone.utc))
        assert p_ancient is None
        
    finally:
        db.client.table("athletes").delete().eq("id", aid).execute()

def test_legacy_import_consistency(db):
    """STRESS TEST: Verify database consistency with physical CSV files."""
    data_dir = "Excel Actuel/Suivi_HR"
    csv_files = [f for f in os.listdir(data_dir) if f.endswith(".csv")]
    
    # Get all athletes from DB
    res = db.client.table("athletes").select("first_name, last_name").execute()
    db_athletes = {f"{a['first_name']} {a['last_name']}" for a in res.data}
    
    # Check that for each unique name in CSVs, there is a DB entry
    for filename in csv_files:
        name_part = filename.split("-")[0].replace("_", " ").strip()
        # Some special cases like "KS" or "Allan" (single names)
        assert any(name_part in db_name for db_name in db_athletes), f"CSV athlete {name_part} not found in DB"

@patch('requests.get')
def test_weather_client_robustness(mock_get):
    """STRESS TEST: Verify weather client handles API responses correctly."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [{"temp": 22.5, "humidity": 60, "weather": [{"description": "clear sky"}]}]
    }
    mock_get.return_value = mock_response
    
    client = WeatherClient(api_key="fake_key")
    data = client.get_weather_at_timestamp(48.8566, 2.3522, datetime.now())
    
    assert data["temp"] == 22.5
    assert data["humidity"] == 60
    mock_get.assert_called_once()

def test_nolio_client_initialization_safety():
    """STRESS TEST: Ensure Nolio client fails gracefully if secrets are missing."""
    client = NolioClient(client_id=None, client_secret=None)
    # Force clear env for this test instance
    client.client_id = None
    client.client_secret = None
    assert client.authenticate() is False
