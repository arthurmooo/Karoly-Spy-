import pytest
import os
from projectk_core.db.connector import DBConnector

@pytest.mark.skipif(not os.getenv("SUPABASE_URL"), reason="Requires Database Connection")
def test_daily_readiness_table_exists():
    """
    Verifies that the 'daily_readiness' table exists and has the required columns.
    """
    db = DBConnector()
    
    # Required columns
    required_columns = [
        'athlete_id', 'date', 'rmssd', 'resting_hr', 
        'sleep_duration', 'sleep_score', 
        'rmssd_30d_avg', 'resting_hr_30d_avg'
    ]
    
    # Check if table exists and columns are present
    # We query information_schema for robustness
    query = """
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'daily_readiness';
    """
    
    # Since DBConnector uses the high-level client, 
    # we might need to use a raw SQL execution if available, 
    # or just try a select.
    
    try:
        # Try a simple select to see if the table exists
        response = db.client.table('daily_readiness').select('*').limit(1).execute()
        
        # If we reach here, the table exists. Now check columns.
        # We can't easily check columns via the high-level client without data.
        # But we can try to select specific columns.
        for col in required_columns:
            try:
                db.client.table('daily_readiness').select(col).limit(1).execute()
            except Exception:
                pytest.fail(f"Column '{col}' is missing from 'daily_readiness' table")
                
    except Exception as e:
        if "relation \"public.daily_readiness\" does not exist" in str(e):
            pytest.fail("Table 'daily_readiness' does not exist")
        else:
            pytest.fail(f"Unexpected error: {e}")
