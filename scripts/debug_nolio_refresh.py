
import os
import requests
import base64
from dotenv import load_dotenv

# Load env
load_dotenv()

def debug_refresh():
    print("🔍 DEBUG: Testing Nolio Refresh Token Flow...")

    client_id = os.getenv("NOLIO_CLIENT_ID")
    client_secret = os.getenv("NOLIO_CLIENT_SECRET")
    refresh_token = os.getenv("NOLIO_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        print("❌ ERROR: Missing credentials in .env")
        return

    print(f"ℹ️  Current Refresh Token (start): {refresh_token[:10]}...")

    url = "https://www.nolio.io/api/token/"
    
    # Prepare Basic Auth
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }

    try:
        response = requests.post(url, headers=headers, data=data)
        
        if response.status_code == 200:
            tokens = response.json()
            print("✅ SUCCESS: Token refreshed!")
            print(f"🔑 New Access Token: {tokens.get('access_token')[:10]}...")
            
            new_refresh = tokens.get('refresh_token')
            if new_refresh:
                print(f"🔄 New Refresh Token returned: {new_refresh[:10]}...")
                if new_refresh != refresh_token:
                    print("⚠️  WARNING: Nolio rotated the refresh token. You MUST save the new one.")
                else:
                    print("ℹ️  Refresh token did not change (Static).")
            else:
                print("❌ STRANGE: No new refresh token returned.")
                
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"❌ EXCEPTION: {e}")

if __name__ == "__main__":
    debug_refresh()
