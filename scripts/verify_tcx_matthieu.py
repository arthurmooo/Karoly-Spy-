import os
import sys
import tempfile
import gzip
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.db.connector import DBConnector
from projectk_core.processing.tcx_parser import TcxParser

def verify_matthieu_tcx():
    db = DBConnector()
    client = NolioClient()
    
    # 1. Get Athlete UUID
    res = db.client.table("athletes").select("id, nolio_id").eq("last_name", "Poullain").execute()
    if not res.data:
        print("❌ Athlete Matthieu Poullain not found in DB.")
        return
    
    athlete_uuid = res.data[0]['id']
    athlete_nolio_id = res.data[0]['nolio_id']
    print(f"found athlete: {athlete_uuid} (Nolio: {athlete_nolio_id})")

    # 2. Get Activity Details (ID known from previous context: 89283171)
    activity_id = "89283171" 
    print(f"📥 Fetching details for activity {activity_id}...")
    details = client.get_activity_details(activity_id, athlete_id=athlete_nolio_id)
    file_url = details.get('file_url')
    
    if not file_url:
        print("❌ No file URL found.")
        return

    # 3. Download File
    print(f"📥 Downloading file from {file_url}...")
    raw_data = client.download_fit_file(file_url) # method name is fit_file but it downloads any binary
    if not raw_data:
        print("❌ Download failed.")
        return

    # 4. Handle Decompression (Manual for now, as Phase 2 is not done)
    # Check for GZIP signature
    is_gz = raw_data.startswith(b'\x1f\x8b\x08')
    
    content_to_parse = raw_data
    if is_gz:
        print("📦 GZIP detected. Decompressing...")
        try:
            content_to_parse = gzip.decompress(raw_data)
        except Exception as e:
            print(f"❌ Decompression failed: {e}")
            return

    # 5. Save to Temp File
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.tcx', delete=False) as tmp:
        tmp.write(content_to_parse)
        tmp_path = tmp.name
    
    print(f"💾 Saved to temporary file: {tmp_path}")

    # 6. Parse with TcxParser
    print("🔄 Parsing with TcxParser...")
    try:
        df, metadata, laps = TcxParser.parse(tmp_path)
        
        print("\n✅ Parsing Successful!")
        print("-" * 30)
        print(f"Metadata: {metadata}")
        print(f"Laps: {len(laps)} found.")
        if laps:
            print(f"First Lap: {laps[0]}")
        print("-" * 30)
        print(f"DataFrame Shape: {df.shape}")
        print(df.head())
        print("-" * 30)
        
        # Validation checks
        if 'heart_rate' in df.columns:
            avg_hr = df['heart_rate'].mean()
            print(f"❤️ Average HR: {avg_hr:.1f} bpm")
        else:
            print("⚠️ No Heart Rate column found.")
            
        if 'power' in df.columns:
            avg_pwr = df['power'].mean()
            print(f"⚡ Average Power: {avg_pwr:.1f} W")
        else:
            print("⚠️ No Power column found.")

    except Exception as e:
        print(f"❌ Parsing failed: {e}")
        # Print first few lines of content for debugging
        print("File content head:")
        print(content_to_parse[:500])
    finally:
        os.remove(tmp_path)

if __name__ == "__main__":
    verify_matthieu_tcx()
