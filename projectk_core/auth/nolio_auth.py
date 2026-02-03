import os
import time
import requests
import base64
import json
from typing import Optional, Dict, Any
from supabase import create_client, Client

class NolioAuthenticator:
    """
    Handles OAuth2 flow for Nolio API.
    Manages Token Exchange and Refresh logic.
    Now syncs Refresh Token with Supabase DB (app_secrets table).
    """
    
    AUTH_URL = "https://www.nolio.io/api/authorize/"
    TOKEN_URL = "https://www.nolio.io/api/token/"
    
    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None, env_path: Optional[str] = None):
        # Only try to load .env if we are missing critical keys and the file exists
        self.env_path = env_path or os.path.join(os.getcwd(), '.env')
        if (not os.environ.get("NOLIO_CLIENT_ID") or not os.environ.get("SUPABASE_URL")) and os.path.exists(self.env_path):
            from dotenv import load_dotenv
            load_dotenv(self.env_path, override=True)
            
        self.client_id = client_id or os.environ.get("NOLIO_CLIENT_ID")
        self.client_secret = client_secret or os.environ.get("NOLIO_CLIENT_SECRET")
        self.redirect_uri = os.environ.get("NOLIO_REDIRECT_URI", "https://google.com")
        
        # Setup Supabase Client for Secret Management
        sb_url = os.environ.get("SUPABASE_URL")
        sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        self.sb_client: Optional[Client] = None
        
        if sb_url and sb_key:
            try:
                self.sb_client = create_client(sb_url, sb_key)
            except Exception as e:
                print(f"⚠️ Supabase Init for Auth failed: {e}")

        # Try to fetch token from DB first, then Env
        self.refresh_token = self._fetch_token_from_db() or os.environ.get("NOLIO_REFRESH_TOKEN")
        
        if not self.client_id:
            raise ValueError("NOLIO_CLIENT_ID missing")
            
        self.access_token = None
        self.expires_at = 0

    def _fetch_token_from_db(self) -> Optional[str]:
        """Reads the refresh token from Supabase app_secrets."""
        if not self.sb_client:
            return None
        try:
            res = self.sb_client.table("app_secrets").select("value").eq("key", "NOLIO_REFRESH_TOKEN").execute()
            if res.data:
                return res.data[0]['value']
        except Exception as e:
            print(f"⚠️ DB Token Read Error: {e}")
        return None

    def get_authorization_url(self) -> str:
        """Generates the URL for the user to click."""
        return f"{self.AUTH_URL}?response_type=code&client_id={self.client_id}&redirect_uri={self.redirect_uri}"

    def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Exchanges the authorization code for access/refresh tokens."""
        if not self.client_secret:
            raise ValueError("NOLIO_CLIENT_SECRET required for token exchange")

        # Basic Auth Header (Base64 client_id:client_secret)
        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri
        }
        
        response = requests.post(self.TOKEN_URL, headers=headers, data=data)
        response.raise_for_status()
        
        token_data = response.json()
        self._update_tokens(token_data)
        return token_data

    def refresh_access_token(self) -> str:
        """Uses the refresh token to get a fresh access token."""
        # Refresh priority: DB -> Env
        db_token = self._fetch_token_from_db()
        if db_token:
            self.refresh_token = db_token
        elif not self.refresh_token:
             self.refresh_token = os.environ.get("NOLIO_REFRESH_TOKEN")
            
        if not self.refresh_token:
            raise ValueError("No refresh token available. Run manual auth first.")
            
        if not self.client_secret:
            self.client_secret = os.environ.get("NOLIO_CLIENT_SECRET")
            
        if not self.client_secret:
            raise ValueError("NOLIO_CLIENT_SECRET required")

        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token
        }
        
        response = requests.post(self.TOKEN_URL, headers=headers, data=data)
        
        if response.status_code == 400:
            raise ValueError("Refresh token invalid or revoked. Re-run manual auth.")
            
        response.raise_for_status()
        
        token_data = response.json()
        self._update_tokens(token_data)
        return self.access_token

    def get_valid_token(self) -> str:
        """Returns a valid access token, refreshing it if necessary."""
        # Simple check: if expired or about to expire in 60s
        if not self.access_token or time.time() > self.expires_at - 60:
            print("Token expired or missing, refreshing...")
            try:
                return self.refresh_access_token()
            except Exception as e:
                # If refresh fails, we might be in initial setup or totally broken
                print(f"Refresh failed: {e}")
                raise
        
        return self.access_token

    def _update_tokens(self, token_data: Dict[str, Any]):
        """Updates internal state with new token data."""
        self.access_token = token_data.get("access_token")
        
        new_refresh = token_data.get("refresh_token")
        if new_refresh:
            self.refresh_token = new_refresh
            self._save_token_securely(new_refresh)
            
        expires_in = token_data.get("expires_in", 3600)
        self.expires_at = time.time() + expires_in

    def _save_token_securely(self, new_token: str):
        """Persists the new refresh token to DB (primary) and .env (fallback)."""
        if not new_token:
            return
            
        # 1. Save to DB (Source of Truth)
        if self.sb_client:
            try:
                self.sb_client.table("app_secrets").upsert({
                    "key": "NOLIO_REFRESH_TOKEN",
                    "value": new_token,
                    "updated_at": "now()"
                }).execute()
                print("💾 SECURITY: Updated Refresh Token in DB.")
            except Exception as e:
                print(f"❌ ERROR: Failed to save token to DB: {e}")

        # 2. Save to local .env (Dev convenience)
        try:
            # Read current lines
            lines = []
            if os.path.exists(self.env_path):
                with open(self.env_path, 'r') as f:
                    lines = f.readlines()
            
            # Write back with updated line
            with open(self.env_path, 'w') as f:
                found = False
                for line in lines:
                    if line.startswith('NOLIO_REFRESH_TOKEN='):
                        f.write(f'NOLIO_REFRESH_TOKEN={new_token}\n')
                        found = True
                    else:
                        f.write(line)
                if not found:
                    if lines and not lines[-1].endswith('\n'):
                        f.write('\n')
                    f.write(f'NOLIO_REFRESH_TOKEN={new_token}\n')
            
            # print(f"💾 SECURITY: Updated .env with new Refresh Token.")
            
        except Exception as e:
            # Not critical if we have DB
            pass
