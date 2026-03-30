import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    # Select 1 row to get column names
    res = supabase.table("activities").select("*").limit(1).execute()
    if res.data:
        print("Columns in 'activities' table:")
        for col in res.data[0].keys():
            print(f"- {col}")
    else:
        print("No data in 'activities' table to inspect columns.")
except Exception as e:
    print(f"Failed to inspect columns: {e}")
