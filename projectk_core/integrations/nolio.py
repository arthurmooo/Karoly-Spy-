import os
import requests
import time
from typing import List, Dict, Optional, Any
from ..auth.nolio_auth import NolioAuthenticator

class NolioClient:
    """
    Client for interacting with the Nolio API.
    Handles rate limiting and token refreshing automatically.
    """
    
    BASE_URL = "https://www.nolio.io/api"
    
    def __init__(self):
        self.auth = NolioAuthenticator()
        self._token = None
    
    def _get_headers(self) -> Dict[str, str]:
        """Ensures valid token and returns headers."""
        self._token = self.auth.get_valid_token()
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/json"
        }

    def get_managed_athletes(self) -> List[Dict[str, Any]]:
        """Fetches list of athletes managed by the coach."""
        url = f"{self.BASE_URL}/get/athletes/"
        response = requests.get(url, headers=self._get_headers())
        
        if response.status_code == 429:
            print("⚠️ Nolio Rate Limit hit. Waiting 60s...")
            time.sleep(60)
            return self.get_managed_athletes()
            
        response.raise_for_status()
        return response.json()

    def get_activities(self, athlete_id: int, date_from: str, date_to: str) -> List[Dict[str, Any]]:
        """
        Fetches COMPLETED activities for a specific athlete.
        Uses the 'limit' param to avoid pagination hell if possible,
        but for range queries we rely on date filters.
        """
        # Note: Nolio endpoint is /get/training/
        # Parameters: athlete_id (if coach), from, to
        url = f"{self.BASE_URL}/get/training/"
        params = {
            "athlete_id": athlete_id,
            "from": date_from,
            "to": date_to,
            "limit": 50 # Max reasonable batch
        }
        
        response = requests.get(url, headers=self._get_headers(), params=params)
        
        if response.status_code == 429:
            print("⚠️ Nolio Rate Limit hit. Waiting 60s...")
            time.sleep(60)
            return self.get_activities(athlete_id, date_from, date_to)
        
        if response.status_code == 400:
            print(f"❌ Nolio API 400 Error: {response.text}")
            
        response.raise_for_status()
        return response.json()

    def download_fit_file(self, file_url: str) -> Optional[bytes]:
        """
        Downloads the FIT file from the temporary URL provided by Nolio.
        Returns raw bytes.
        """
        if not file_url:
            return None
            
        try:
            # Note: The file_url is usually a signed AWS/GCS link, 
            # so we don't need the Nolio Auth header for this specific call,
            # just a standard GET.
            response = requests.get(file_url, stream=True)
            response.raise_for_status()
            return response.content
        except Exception as e:
            print(f"❌ Download failed for {file_url}: {e}")
            return None