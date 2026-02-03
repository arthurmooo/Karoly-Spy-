
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def check_nulls():
    db = DBConnector()
    print("🔍 Querying view_intervals_karo for NULL values...")
    
    # We can't query views directly via RPC easily if they are not exposed, 
    # but we can query the 'activities' table and mimic the view logic or use raw SQL if possible.
    # Actually, supabase client can query views like tables.
    
    try:
        res = db.client.table("view_intervals_karo").select("*").limit(1).execute()
        if res.data:
            print(f"DEBUG: Column names in view: {list(res.data[0].keys())}")
        
        # Try a more generic query if Puissance is problematic
        res = db.client.table("view_intervals_karo").select("*").limit(20).execute()
        
        if res.data:
            print(f"📍 Found {len(res.data)} activities:")
            for row in res.data[:10]:
                print(f"--- Activity: {row.get('seance')} | Athlete: {row.get('athlete')} | Sport: {row.get('sport')} ---")
                for k, v in row.items():
                    print(f"  {k}: {v}")
        else:
            print("✅ No data found in the view.")
            
    except Exception as e:
        print(f"❌ Error querying view: {e}")

if __name__ == "__main__":
    check_nulls()
