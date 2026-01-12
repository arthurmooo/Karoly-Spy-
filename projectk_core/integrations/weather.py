import os
import requests
from typing import Optional, Dict, Any
from datetime import datetime

class WeatherClient:
    """
    Client for OpenWeatherMap API to retrieve historical weather data.
    """
    BASE_URL = "https://api.openweathermap.org/data/3.0/onecall/timemachine"

    def __init__(self, api_key: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = os.environ.get("OPENWEATHER_API_KEY")

    def get_weather_at_timestamp(self, lat: float, lon: float, dt: datetime) -> Optional[Dict[str, Any]]:
        """
        Fetch historical weather for a specific location and time.
        """
        if not self.api_key:
            return None
            
        params = {
            "lat": lat,
            "lon": lon,
            "dt": int(dt.timestamp()),
            "appid": self.api_key,
            "units": "metric"
        }
        
        try:
            response = requests.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "data" in data and len(data["data"]) > 0:
                return data["data"][0]
            return None
        except Exception as e:
            print(f"Error fetching weather: {e}")
            return None
