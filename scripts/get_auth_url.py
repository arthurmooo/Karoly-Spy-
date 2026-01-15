
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def main():
    try:
        auth = NolioAuthenticator()
        url = auth.get_authorization_url()
        print("\n=== NOLIO AUTHORIZATION URL ===")
        print("Please click the link below to authorize the app:")
        print(url)
        print("===============================\n")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()

