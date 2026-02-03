import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env variables if .env exists, but don't override existing system variables (like GitHub Secrets)
load_dotenv()

class DBConnector:
    """
    Handles connection to Supabase using credentials from environment variables.
    Uses the Service Role Key for backend administrative operations.
    """
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            print(f"DEBUG: SUPABASE_URL present: {bool(url)}")
            print(f"DEBUG: SUPABASE_SERVICE_ROLE_KEY present: {bool(key)}")
            raise ValueError("Supabase credentials (URL or SERVICE_ROLE_KEY) not found in environment variables.")
            
        # Ensure trailing slash for Supabase client
        if not url.endswith("/"):
            url += "/"
            
        self.client: Client = create_client(url, key)
