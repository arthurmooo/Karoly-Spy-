import pytest
from projectk_core.db.connector import DBConnector
import os

# Skip if no database credentials
@pytest.mark.skipif(not os.getenv("SUPABASE_URL"), reason="Requires Database Connection")
def test_migration_003_add_segmented_metrics_column():
    """
    Verifies that the migration 003 adds the 'segmented_metrics' JSONB column to the 'activities' table.
    """
    db = DBConnector()
    
    # Check if column exists
    # We query the information_schema
    query = """
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'segmented_metrics';
    """
    
    # We expect this to fail BEFORE the migration is applied (or if I haven't written it yet)
    # But for TDD, I write the test that expects the column to be there.
    # Since I haven't applied the migration, this test currently FAILS (or returns empty result).
    
    try:
        # Alternative: Try to select the column from the table. If it fails, the column doesn't exist.
        try:
            db.client.table('activities').select('segmented_metrics').limit(1).execute()
            exists = True
        except Exception:
            exists = False
            
        assert exists, "Column 'segmented_metrics' should exist in 'activities' table"
        
    except Exception as e:
        pytest.fail(f"Test failed with error: {e}")
