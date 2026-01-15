
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.weather import WeatherClient

def test_weather():
    print("=== Testing OpenWeather Integration ===")
    client = WeatherClient()
    
    # Test coordinates: Annecy (Proche de Karoly)
    lat, lon = 45.8992, 6.1294
    # Une date fixe (hier)
    dt = datetime.now(timezone.utc).replace(day=datetime.now().day - 1)
    
    print(f"Fetching weather for Annecy at {dt}...")
    data = client.get_weather_at_timestamp(lat, lon, dt)
    
    if data:
        print(f"✅ Success!")
        print(f"   Temp: {data.get('temp')}°C")
        print(f"   Humidity: {data.get('humidity')}%")
        print(f"   Weather: {data.get('weather')[0]['description']}")
    else:
        print("❌ Failed to fetch weather data. Check API Key or Endpoint permissions.")

if __name__ == "__main__":
    test_weather()
