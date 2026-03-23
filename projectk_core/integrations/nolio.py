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
            print("⚠️ Nolio Rate Limit hit. Aborting to avoid infinite loop.")
            raise Exception("NolioRateLimitError")
            
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
            print("⚠️ Nolio Rate Limit hit. Aborting.")
            raise Exception("NolioRateLimitError")
        
        if response.status_code == 400:
            print(f"❌ Nolio API 400 Error: {response.text}")
            
        response.raise_for_status()
        return response.json()

    def get_athlete_metrics(self, athlete_id: int) -> Dict[str, Any]:
        """
        Fetches physiological metrics (CP, CS, etc.) for an athlete.
        """
        url = f"{self.BASE_URL}/get/user/meta/"
        params = {"athlete_id": athlete_id}
        response = requests.get(url, headers=self._get_headers(), params=params)
        
        if response.status_code == 429:
            time.sleep(60)
            return self.get_athlete_metrics(athlete_id)
            
        response.raise_for_status()
        return response.json()

    def get_athlete_health_metrics(self, athlete_id: int, days: int = 7) -> Dict[str, Dict[str, Any]]:
        """
        Fetches daily health metrics (RMSSD, HRrest, Sleep) for an athlete.
        Returns a dict indexed by date: { "YYYY-MM-DD": { "rmssd": float, ... } }
        """
        url = f"{self.BASE_URL}/get/user/meta/"
        # We use a larger limit to ensure we get enough history for the requested days
        params = {
            "athlete_id": athlete_id,
            "limit": max(days * 2, 30) 
        }
        
        response = requests.get(url, headers=self._get_headers(), params=params)
        response.raise_for_status()
        raw_data = response.json()
        
        # Mapping between Nolio keys and our internal names
        # sleep is in seconds, resting_hr is 'hrrest'
        mapping = {
            "rmssd": "rmssd",
            "hrrest": "resting_hr",
            "sleep": "sleep_duration",
            "scoresommeil": "sleep_score"
        }
        
        # Structure the results by date
        daily_data = {}
        
        for nolio_key, internal_key in mapping.items():
            if nolio_key in raw_data:
                metrics_list = raw_data[nolio_key].get("data", [])
                for entry in metrics_list:
                    d = entry.get("date")
                    val = entry.get("value")
                    
                    if not d or val is None:
                        continue
                        
                    if d not in daily_data:
                        daily_data[d] = {
                            "rmssd": None,
                            "resting_hr": None,
                            "sleep_duration": None,
                            "sleep_score": None
                        }
                    
                    # Special handling for sleep (seconds to hours)
                    if nolio_key == "sleep":
                        val = round(val / 3600.0, 2)
                        
                    # First entry wins — Nolio returns the most recent/primary entry first
                    if daily_data[d][internal_key] is None:
                        daily_data[d][internal_key] = val
                    
        return daily_data

    def get_activity_structure(self, activity_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetches the detailed structure (planned workout) of an activity.
        """
        url = f"{self.BASE_URL}/get/training/"
        # We query the specific activity ID to get its details, including 'structured_workout'
        params = {"id": activity_id}
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            if response.status_code == 200:
                # API returns a list, we take the first item
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    return data[0].get("structured_workout")
            return None
        except Exception as e:
            print(f"⚠️ Failed to fetch structure for {activity_id}: {e}")
            return None

    def get_activity_details(self, activity_id: int, athlete_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Fetches full details of a single activity (realized).
        """
        url = f"{self.BASE_URL}/get/training/"
        params = {"id": activity_id}
        if athlete_id:
            params["athlete_id"] = athlete_id
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            data = response.json()
            return data[0] if data else None
        except Exception as e:
            print(f"⚠️ Failed to fetch details for {activity_id}: {e}")
            return None

    def get_planned_workout(self, planned_id: int, athlete_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Fetches the detailed structure of a PLANNED workout.
        """
        url = f"{self.BASE_URL}/get/planned/training/"
        params = {"id": planned_id}
        if athlete_id:
            params["athlete_id"] = athlete_id
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            data = response.json()
            return data[0] if data else None
        except Exception as e:
            print(f"⚠️ Failed to fetch planned workout {planned_id}: {e}")
            return None

    def get_planned_workout_by_id(self, planned_id: int, athlete_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Alias for get_planned_workout for clarity."""
        return self.get_planned_workout(planned_id, athlete_id=athlete_id)

    def get_planned_workouts_range(self, athlete_id: int, date_from: str, date_to: str) -> List[Dict[str, Any]]:
        """Fetches ALL planned workouts for an athlete within a date range."""
        url = f"{self.BASE_URL}/get/planned/training/"
        params = {"athlete_id": athlete_id, "from": date_from, "to": date_to}
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            return response.json() or []
        except Exception as e:
            print(f"⚠️ Failed to fetch planned workouts range for athlete {athlete_id}: {e}")
            return []

    def find_planned_workout(self, athlete_id: int, date: Any, title_filter: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Searches for a planned workout within the same week (Monday-Sunday) around the given date.
        Optionally filters by fuzzy title match.
        """
        from datetime import timedelta
        import pandas as pd
        
        # Convert to datetime if needed
        if isinstance(date, str):
            try:
                date_obj = pd.to_datetime(date)
            except:
                return None
        else:
            date_obj = date

        # Calculate Start/End of Week (Monday to Sunday)
        start_of_week = date_obj - timedelta(days=date_obj.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        
        date_from = start_of_week.strftime("%Y-%m-%d")
        date_to = end_of_week.strftime("%Y-%m-%d")
        
        url = f"{self.BASE_URL}/get/planned/training/"
        params = {
            "athlete_id": athlete_id,
            "from": date_from,
            "to": date_to
        }
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            planned_sessions = response.json()
            
            if not planned_sessions:
                return None
                
            # If title filter is provided, try to find the best match
            if title_filter:
                t_norm = title_filter.lower().strip()
                best_match = None
                best_score = 0
                
                for s in planned_sessions:
                    s_name = s.get("name", "").lower().strip()
                    # Calculate a simple similarity score
                    score = 0
                    if t_norm in s_name or s_name in t_norm:
                        score = 50 # Base match
                    if t_norm == s_name:
                        score = 100 # Perfect match
                    
                    # Bonus if it's on the exact same day
                    if s.get("date_start") == date_obj.strftime("%Y-%m-%d"):
                        score += 20
                        
                    if score > best_score:
                        best_score = score
                        best_match = s
                
                if best_score >= 50:
                    return best_match
            
            # If no title match, pick the one on the exact day if unique
            same_day_plans = [s for s in planned_sessions if s.get("date_start") == date_obj.strftime("%Y-%m-%d")]
            if len(same_day_plans) == 1:
                return same_day_plans[0]

            return None

            
        except Exception as e:
            print(f"⚠️ Failed to find planned workout for {athlete_id} around {date}: {e}")
            return None

    def download_fit_file(self, file_url: str, retries: int = 3) -> Optional[bytes]:
        """
        Downloads the FIT file from the temporary URL provided by Nolio.
        Includes retry logic (3 attempts) with backoff.
        Returns raw bytes.
        """
        if not file_url:
            return None
            
        for attempt in range(retries):
            try:
                # Note: The file_url is usually a signed AWS/GCS link, 
                # so we don't need the Nolio Auth header for this specific call.
                # Added timeout to prevent hanging.
                response = requests.get(file_url, stream=True, timeout=30)
                response.raise_for_status()
                return response.content
            except Exception as e:
                print(f"⚠️ Download attempt {attempt + 1}/{retries} failed for {file_url}: {e}")
                if attempt < retries - 1:
                    time.sleep(2 * (attempt + 1))  # Simple linear backoff: 2s, 4s...
                else:
                    print(f"❌ Final download failure.")
                    return None
        return None

    def update_activity_comment(self, activity_id: int, comment: str, athlete_id: Optional[int] = None) -> bool:
        """
        Updates the comment of an activity on Nolio.
        Used to write back the 'Karoly Load' (MLS) and other indices.
        """
        url = f"{self.BASE_URL}/update/training/"
        payload = {
            "id": activity_id,
            "description": comment
        }
        if athlete_id:
            payload["athlete_id"] = athlete_id
            
        try:
            response = requests.post(url, headers=self._get_headers(), json=payload)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"⚠️ Failed to update Nolio comment for activity {activity_id}: {e}")
            return False

    def get_notes(self, athlete_id: int, date_from: str, date_to: str) -> List[Dict[str, Any]]:
        """
        Fetches notes for a specific athlete within a date range.
        Used for retrieving physiological profiles stored as notes.
        """
        url = f"{self.BASE_URL}/get/note/"
        params = {
            "athlete_id": athlete_id,
            "from": date_from,
            "to": date_to
        }
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"⚠️ Failed to fetch notes for athlete {athlete_id}: {e}")
            return []