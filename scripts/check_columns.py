import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def check_columns():
    db = DBConnector()
    print("Checking columns for 'activities' table...")
    try:
        # Query information_schema
        res = db.client.rpc("get_table_columns", {"t_name": "activities"}).execute()
        if res.data:
            print(res.data)
        else:
            # Fallback: try to get one row and check keys
            res = db.client.table("activities").select("*").limit(1).execute()
            if res.data:
                print("Columns found in record:", list(res.data[0].keys()))
            else:
                print("No data in table to infer columns.")
    except Exception as e:
        print(f"Error: {e}")
        # Try a direct query via postgrest to see if we can get anything
        try:
            res = db.client.table("activities").select("*").limit(1).execute()
            if res.data:
                print("Columns (fallback):", list(res.data[0].keys()))
        except Exception as e2:
            print(f"Fallback error: {e2}")

if __name__ == "__main__":
    check_columns()
