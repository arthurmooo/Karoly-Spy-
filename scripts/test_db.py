import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"Connecting to: {url}")
supabase = create_client(url, key)

try:
    res = supabase.table("athletes").select("*", count="exact").execute()
    print(f"Success! Found {res.count} athletes.")
except Exception as e:
    print(f"Failed: {e}")
