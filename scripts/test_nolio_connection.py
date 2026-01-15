
import os
import requests
import base64

def test_connection():
    client_id = "h7P9ESHPLQYzy82mUn8Y6P1defhycaz8FrCHjW79"
    client_secret = "2yYSxElTGVScRBpJUevH5xyVtyNrLE9QRjzTOgZavnyl7F9Vc9W2Pb4YY51D72623VU1IBF5gUCFPblFt9txmnxm4rGeTmEZcowNUy8pHWLONpjtathVlqOjekBdN9Vc"
    
    # Just a basic check if the endpoint responds
    print("Testing connection to Nolio Token URL...")
    try:
        auth_str = f"{client_id}:{client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        headers = {"Authorization": f"Basic {b64_auth}"}
        
        # This will fail with 400 because no grant_type, but it proves basic auth works
        response = requests.post("https://www.nolio.io/api/token/", headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
