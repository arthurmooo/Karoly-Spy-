
import os
import sys
import tempfile
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.db.connector import DBConnector

def inspect_file_content(nolio_id, athlete_uuid):
    db = DBConnector()
    client = NolioClient()
    
    ath_res = db.client.table("athletes").select("nolio_id").eq("id", athlete_uuid).execute()
    athlete_nolio_id = ath_res.data[0]['nolio_id'] if ath_res.data else None
    
    print(f"🧐 Inspecting file for Activity {nolio_id} (Athlete {athlete_nolio_id})...")
    details = client.get_activity_details(nolio_id, athlete_id=athlete_nolio_id)
    file_url = details.get('file_url')
    
    if not file_url:
        print("No file URL found.")
        return

    fit_data = client.download_fit_file(file_url)
    if not fit_data:
        print("Failed to download file.")
        return

    print(f"File size: {len(fit_data)} bytes")
    # Check first 20 bytes to see file signature
    print(f"First 50 bytes (hex): {fit_data[:50].hex()}")
    print(f"First 50 bytes (text): {fit_data[:50]}")
    
    import gzip
    try:
        decompressed = gzip.decompress(fit_data)
        print(f"Decompressed size: {len(decompressed)} bytes")
        print(f"Decompressed first 100 bytes (hex): {decompressed[:100].hex()}")
        print(f"Decompressed first 100 bytes (text): {decompressed[:100]}")
        if b".FIT" in decompressed[:50]:
            print("Found .FIT signature in DECOMPRESSED header.")
        elif b"<?xml" in decompressed[:50]:
            print("This looks like an XML file (TCX or GPX) inside a GZIP.")
    except Exception as e:
        print(f"Failed to decompress: {e}")

if __name__ == "__main__":
    # Matthieu Poullain's UUID and activity ID from previous logs
    # 89283171
    # Let's find his UUID from the name to be sure
    db = DBConnector()
    res = db.client.table("athletes").select("id").eq("last_name", "Poullain").execute()
    if res.data:
        inspect_file_content("89283171", res.data[0]['id'])
    else:
        print("Athlete Matthieu Poullain not found.")
