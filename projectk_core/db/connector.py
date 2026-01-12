import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Explicitly load env variables, override if already set in session
load_dotenv(override=True)

class DBConnector:
    """
    Handles connection to Supabase using credentials from environment variables.
    Uses the Service Role Key for backend administrative operations.
    """
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError("Supabase credentials (URL or SERVICE_ROLE_KEY) not found in environment variables.")
            
        self.client: Client = create_client(url, key)
