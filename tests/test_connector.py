import os
import pytest
from projectk_core.db.connector import DBConnector

def test_db_connection():
    """Test that we can connect to Supabase and execute a simple query."""
    # Ensure env is loaded
    assert os.getenv("SUPABASE_URL") is not None
    assert os.getenv("SUPABASE_SERVICE_ROLE_KEY") is not None

    db = DBConnector()
    # Test a simple count on the athletes table (should be 0 or more)
    response = db.client.table("athletes").select("*", count="exact").limit(1).execute()
    
    assert response is not None
    assert hasattr(response, "data")
