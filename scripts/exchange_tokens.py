
import sys
import os
import base64
import requests

def exchange_code():
    client_id = "h7P9ESHPLQYzy82mUn8Y6P1defhycaz8FrCHjW79"
    client_secret = "2yYSxElTGVScRBpJUevH5xyVtyNrLE9QRjzTOgZavnyl7F9Vc9W2Pb4YY51D72623VU1IBF5gUCFPblFt9txmnxm4rGeTmEZcowNUy8pHWLONpjtathVlqOjekBdN9Vc"
    code = "tytw9J8sT4pvIJGZZlmzWB6LwpduN7"
    redirect_uri = "https://google.com"
    
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri
    }
    
    response = requests.post("https://www.nolio.io/api/token/", headers=headers, data=data)
    
    if response.status_code == 200:
        tokens = response.json()
        print("TOKEN_EXCHANGE_SUCCESS")
        print(f"REFRESH_TOKEN={tokens.get('refresh_token')}")
    else:
        print(f"ERROR: {response.status_code}")
        print(f"BODY: {response.text}")

if __name__ == "__main__":
    exchange_code()
