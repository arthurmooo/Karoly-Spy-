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

def multi_validate():
    db = DBConnector()
    client = NolioClient()
    
    res = db.client.table("athletes").select("id, nolio_id").eq("last_name", "Poullain").execute()
    athlete_nolio_id = res.data[0]['nolio_id']
    
    ids = ["89283171", "89283169", "89094160", "89278287"]
    
    for activity_id in ids:
        print(f"\n--- Testing Activity {activity_id} ---")
        try:
            details = client.get_activity_details(activity_id, athlete_id=athlete_nolio_id)
            file_url = details.get('file_url')
            if not file_url:
                print(f"Skipping {activity_id}: No file URL")
                continue
            
            raw_data = client.download_fit_file(file_url)
            ext = ".fit"
            if ".tcx" in file_url.lower(): ext = ".tcx"
            if "gzip" in file_url.lower() or "gz" in file_url.lower(): ext += ".gz"
            
            with tempfile.NamedTemporaryFile(mode='wb', suffix=ext, delete=False) as tmp:
                tmp.write(raw_data)
                tmp_path = tmp.name
            
            df, metadata, laps = UniversalParser.parse(tmp_path)
            print(f"✅ Success: {len(df)} rows, {len(laps)} laps")
            if 'heart_rate' in df.columns:
                print(f"   Avg HR: {df['heart_rate'].mean():.1f}")
            if 'power' in df.columns:
                print(f"   Avg Power: {df['power'].mean():.1f}")
                
            os.remove(tmp_path)
        except Exception as e:
            print(f"❌ Failed {activity_id}: {e}")

if __name__ == "__main__":
    multi_validate()
