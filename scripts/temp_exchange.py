import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def exchange():
    code = "iOhxJzWwIMp7dq3mpQAMHrnPt5mHfv"
    print(f"Exchanging code: {code}")
    
    auth = NolioAuthenticator()
    try:
        tokens = auth.exchange_code_for_token(code)
        print("✅ Success! Tokens updated in .env")
        print(f"New Refresh Token: {tokens.get('refresh_token')[:10]}...")
    except Exception as e:
        print(f"❌ Exchange failed: {e}")

if __name__ == "__main__":
    exchange()