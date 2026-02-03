
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def check_intervals():
    db = DBConnector()
    print("🔍 Checking activity_intervals table...")
    
    res = db.client.table("activity_intervals").select("id").limit(10).execute()
    print(f"Found {len(res.data)} sample intervals.")
    
    res_count = db.client.table("activity_intervals").select("id", count="exact").limit(0).execute()
    print(f"Total intervals in DB: {res_count.count}")

if __name__ == "__main__":
    check_intervals()
