import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    res = supabase.table("activities").select("sport_type, source_sport").execute()
    sports = set()
    for row in res.data:
        sports.add(row.get("sport_type"))
        sports.add(row.get("source_sport"))
    print("Detected sports:")
    for s in sorted(list(filter(None, sports))):
        print(f"- {s}")
except Exception as e:
    print(f"Failed: {e}")
