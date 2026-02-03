
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def get_view_def():
    db = DBConnector()
    print("🔍 Fetching definition for view_intervals_karo...")
    
    try:
        # We use a trick to run raw SQL via the client if possible, 
        # or we use the rpc if there is one. 
        # Since we don't have a direct sql executor in the client, we might be limited.
        # But maybe we can query pg_views.
        
        res = db.client.rpc("get_view_definition", {"view_name": "view_intervals_karo"}).execute()
        if res.data:
            print("SQL Definition:")
            print(res.data)
        else:
            print("❌ RPC 'get_view_definition' not found or returned no data.")
            
            # Fallback: try to see if we can query it via table select (unlikely to work for system tables)
            # res = db.client.table("pg_views").select("definition").eq("viewname", "view_intervals_karo").execute()
            # This usually fails due to RLS/Permissions on system tables.
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    get_view_def()
