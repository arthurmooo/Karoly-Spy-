import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load env variables (for client_id/secret and Supabase keys)
load_dotenv(override=True)

from projectk_core.auth.nolio_auth import NolioAuthenticator

def run_manual_auth():
    print("=== 🔐 Nolio OAuth2 Manual Setup (Centralized Mode) ===")
    
    client_id = os.environ.get("NOLIO_CLIENT_ID")
    client_secret = os.environ.get("NOLIO_CLIENT_SECRET")
    redirect_uri = os.environ.get("NOLIO_REDIRECT_URI", "https://google.com")
    
    if not client_id:
        client_id = input("Enter NOLIO_CLIENT_ID: ").strip()
    
    if not client_secret:
        client_secret = input("Enter NOLIO_CLIENT_SECRET: ").strip()
        
    custom_redirect = input(f"Enter Redirect URI (default: {redirect_uri}): ").strip()
    if custom_redirect:
        redirect_uri = custom_redirect
        
    if not client_id or not client_secret:
        print("❌ Error: Credentials required.")
        return

    # Set env var for authenticator to pick up
    os.environ["NOLIO_REDIRECT_URI"] = redirect_uri

    # Authenticator will automatically handle Supabase connection if keys are in env
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
        
    print("\n⏳ Exchanging code for tokens...")
    try:
        tokens = auth.exchange_code_for_token(code)
        print("\n✅ SUCCESS!")
        print("-" * 60)
        print(f"ACCESS_TOKEN  : {tokens.get('access_token')[:20]}...")
        print(f"REFRESH_TOKEN : {tokens.get('refresh_token')[:20]}...")
        print("-" * 60)
        print("✨ Token has been automatically saved to Supabase (app_secrets) and your local .env file.")
        print("🚀 Your GitHub Action robot is now ready to use this new token.")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    run_manual_auth()
