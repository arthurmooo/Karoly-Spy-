import os
from dotenv import load_dotenv

print("--- Manual .env Read ---")
try:
    with open(".env", "r") as f:
        for line in f:
            if "NOLIO_CLIENT_SECRET" in line:
                print(f"Line found: {line.strip()[:30]}...")
except Exception as e:
    print(f"Error reading .env: {e}")

print("\n--- Dotenv Load ---")
res = load_dotenv()
print(f"load_dotenv result: {res}")
val = os.environ.get("NOLIO_CLIENT_SECRET")
print(f"NOLIO_CLIENT_SECRET from os.environ: {val[:10]}..." if val else "STILL NONE")