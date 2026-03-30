import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    res = supabase.table("activities").select("work_type", count="exact").eq("work_type", "intervals").execute()
    print(f"Activities with work_type='intervals': {res.count}")
    if res.count > 0:
        # Show sample data
        res_data = supabase.table("activities").select("activity_name, sport_type, interval_power_last, interval_pace_last").eq("work_type", "intervals").limit(3).execute()
        for row in res_data.data:
            print(f"- {row['activity_name']} ({row['sport_type']}): Power Last={row['interval_power_last']}, Pace Last={row['interval_pace_last']}")
except Exception as e:
    print(f"Failed: {e}")
