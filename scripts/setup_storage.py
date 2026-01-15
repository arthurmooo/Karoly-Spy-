import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector

def setup_storage():
    print("=== Supabase Storage Setup ===")
    db = DBConnector()
    client = db.client
    
    bucket_name = "raw_fits"
    
    # Check if bucket exists
    try:
        buckets = client.storage.list_buckets()
        exists = any(b.name == bucket_name for b in buckets)
        
        if not exists:
            print(f"Creating bucket '{bucket_name}'...")
            client.storage.create_bucket(bucket_name, options={"public": False})
            print("✅ Bucket created.")
        else:
            print(f"✅ Bucket '{bucket_name}' already exists.")
            
    except Exception as e:
        print(f"❌ Storage Error: {e}")

if __name__ == "__main__":
    setup_storage()