import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/exchange_tokens.py <code>")
        sys.exit(1)
        
    code = sys.argv[1]
    
    try:
        print(f"🔄 Exchanging code: {code}...")
        auth = NolioAuthenticator()
        tokens = auth.exchange_code_for_token(code)
        
        if tokens.get('refresh_token'):
            print("\n✅ SUCCESS!")
            print(f"New Refresh Token: {tokens.get('refresh_token')[:10]}...")
            print("The token has been automatically saved to Supabase (app_secrets).")
        else:
            print("❌ Error: No refresh token received in response.")
            print(tokens)
            
    except Exception as e:
        print(f"\n❌ ERROR during exchange: {e}")
        # If it's a 400, it's likely an expired code
        if "400" in str(e):
            print("The code might have expired. Please generate a new one.")

if __name__ == "__main__":
    main()