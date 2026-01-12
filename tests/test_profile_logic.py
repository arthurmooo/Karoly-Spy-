import pytest
from datetime import datetime, timedelta
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.db.connector import DBConnector

def test_profile_retrieval_scd2():
    """Test that we get the correct profile based on the date (SCD Type 2)."""
    db = DBConnector()
    pm = ProfileManager(db)
    
    # 1. Setup: Create a temporary athlete
    athlete = db.client.table("athletes").insert({
        "first_name": "Test",
        "last_name": "Athlete"
    }).execute().data[0]
    athlete_id = athlete["id"]
    
    try:
        # 2. Setup: Create two profiles
        # Profile A: valid from 2023-01-01 to 2023-12-31
        # Profile B: valid from 2024-01-01 to infinity
        
        db.client.table("physio_profiles").insert([
            {
                "athlete_id": athlete_id,
                "sport": "run",
                "lt1_hr": 140,
                "valid_from": "2023-01-01T00:00:00+00:00",
                "valid_to": "2023-12-31T23:59:59+00:00"
            },
            {
                "athlete_id": athlete_id,
                "sport": "run",
                "lt1_hr": 150,
                "valid_from": "2024-01-01T00:00:00+00:00",
                "valid_to": None
            }
        ]).execute()
        
        # 3. Test retrieval for 2023
        profile_2023 = pm.get_profile_for_date(athlete_id, "run", datetime(2023, 6, 1))
        assert profile_2023["lt1_hr"] == 140
        
        # 4. Test retrieval for 2024
        profile_2024 = pm.get_profile_for_date(athlete_id, "run", datetime(2024, 6, 1))
        assert profile_2024["lt1_hr"] == 150
        
    finally:
        # Cleanup
        db.client.table("athletes").delete().eq("id", athlete_id).execute()
