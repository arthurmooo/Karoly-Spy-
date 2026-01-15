
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator
import requests

def test_api():
    print("=== Testing Nolio API Access ===")
    auth = NolioAuthenticator()
    try:
        token = auth.get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test: Get managed athletes
        response = requests.get("https://www.nolio.io/api/get/athletes/", headers=headers)
        
        if response.status_code == 200:
            athletes = response.json()
            print(f"✅ Success! Found {len(athletes)} athletes.")
            for a in athletes[:3]:
                print(f" - {a.get('name')} (ID: {a.get('nolio_id')})")
            if len(athletes) > 3:
                print(" ...")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Body: {response.text}")
            
    except Exception as e:
        print(f"❌ Setup Error: {e}")

if __name__ == "__main__":
    test_api()
