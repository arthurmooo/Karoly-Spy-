import os
import sys
import tempfile
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.db.connector import DBConnector
from projectk_core.processing.parser import UniversalParser

def validate_tcx_support():
    print("🚀 Starting TCX Support Validation (Phase 3)...")
    
    db = DBConnector()
    client = NolioClient()
    
    # Target: Matthieu Poullain
    res = db.client.table("athletes").select("id, nolio_id").eq("last_name", "Poullain").execute()
    if not res.data:
        print("❌ Athlete Matthieu Poullain not found.")
        sys.exit(1)
    
    athlete_nolio_id = res.data[0]['nolio_id']
    
    # Target Activity: 89283171 (Known TCX/GZ file)
    activity_id = "89283171"
    print(f"📥 Fetching activity {activity_id}...")
    
    try:
        details = client.get_activity_details(activity_id, athlete_id=athlete_nolio_id)
        file_url = details.get('file_url')
        if not file_url:
            print("❌ No file URL found.")
            sys.exit(1)
            
        print(f"📥 Downloading from {file_url}...")
        raw_data = client.download_fit_file(file_url)
        
        # Determine extension from URL for realistic testing
        ext = ".fit"
        if ".tcx" in file_url.lower():
            ext = ".tcx"
        if "gzip" in file_url.lower() or "gz" in file_url.lower():
            ext += ".gz"
            
        # Save to temp file
        with tempfile.NamedTemporaryFile(mode='wb', suffix=ext, delete=False) as tmp:
            tmp.write(raw_data)
            tmp_path = tmp.name
        
        print(f"💾 Saved to {tmp_path} (Extension: {ext})")
        
        # Parse using UniversalParser
        print("🔄 Parsing with UniversalParser...")
        df, metadata, laps = UniversalParser.parse(tmp_path)
        
        # Validation
        print("\n✅ Parsing Successful!")
        print(f"   Rows: {len(df)}")
        print(f"   Laps: {len(laps)}")
        
        # Parity Checks (Reference values from previous manual run)
        # HR ~99.8, Power ~129.3
        avg_hr = df['heart_rate'].mean()
        avg_pwr = df['power'].mean()
        
        print(f"   Avg HR: {avg_hr:.2f} bpm")
        print(f"   Avg Power: {avg_pwr:.2f} W")
        
        if not (98 < avg_hr < 102):
            print("⚠️ HR verification failed (Expected ~100 bpm)")
            sys.exit(1)
            
        if not (128 < avg_pwr < 131):
            print("⚠️ Power verification failed (Expected ~129 W)")
            sys.exit(1)
            
        print("\n🎉 VALIDATION PASSED: UniversalParser correctly handled the TCX/GZIP file.")
        
    except Exception as e:
        print(f"❌ Validation Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    validate_tcx_support()
