import sys
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def run_manual_auth():
    print("=== Nolio OAuth2 Manual Setup ===")
    
    client_id = os.environ.get("NOLIO_CLIENT_ID")
    client_secret = os.environ.get("NOLIO_CLIENT_SECRET")
    
    if not client_id:
        client_id = input("Enter NOLIO_CLIENT_ID: ").strip()
    
    if not client_secret:
        client_secret = input("Enter NOLIO_CLIENT_SECRET: ").strip()
        
    if not client_id or not client_secret:
        print("Error: Credentials required.")
        return

    auth = NolioAuthenticator(client_id, client_secret)
    
    print("\n1. Please visit this URL in your browser:")
    print("-" * 60)
    print(auth.get_authorization_url())
    print("-" * 60)
    
    print("\n2. Log in, authorize the app.")
    print("3. You will be redirected to https://google.com/?code=...")
    print("4. Copy the value of 'code' from the URL bar.")
    
    code = input("\nEnter the CODE here: ").strip()
    
    if not code:
        print("No code provided.")
        return
        
    print("\nExchanging code for tokens...")
    try:
        tokens = auth.exchange_code_for_token(code)
        print("\n✅ SUCCESS!")
        print("-" * 60)
        print(f"ACCESS_TOKEN: {tokens.get('access_token')}")
        print(f"REFRESH_TOKEN: {tokens.get('refresh_token')}")
        print("-" * 60)
        print("⚠️  Action Required: Save 'REFRESH_TOKEN' in your .env file as NOLIO_REFRESH_TOKEN")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    run_manual_auth()
