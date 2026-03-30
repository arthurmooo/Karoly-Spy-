from projectk_core.db.connector import DBConnector

try:
    db = DBConnector()
    # Try a simple read
    res = db.client.table("athletes").select("id", count="exact").limit(1).execute()
    print("✅ Local Supabase connection successful!")
    print(f"   Found {res.count} athletes.")
except Exception as e:
    print(f"❌ Local Supabase connection failed: {e}")
