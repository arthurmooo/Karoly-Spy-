import os
import sys
import tempfile
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser
from projectk_core.db.connector import DBConnector

def audit_null_hr():
    db = DBConnector()
    client = NolioClient()
    
    # Get 10 activities with NULL avg_hr
    res = db.client.table("activities")\
        .select("id, nolio_id, athlete_id, activity_name, athletes(first_name, last_name)")\
        .is_("avg_hr", "null")\
        .limit(10)\
        .execute()
    
    activities = res.data
    print(f"🔍 Auditing {len(activities)} activities with NULL avg_hr...\n")
    
    for act in activities:
        nolio_id = act['nolio_id']
        athlete_uuid = act['athlete_id']
        ath_res = db.client.table("athletes").select("nolio_id").eq("id", athlete_uuid).execute()
        athlete_nolio_id = ath_res.data[0]['nolio_id'] if ath_res.data else None
        
        ath_name = f"{act['athletes']['first_name']} {act['athletes']['last_name']}"
        print(f"👉 Activity: {nolio_id} ({act['activity_name']}) - Athlete: {ath_name}")
        
        # Get details to get file_url
        details = client.get_activity_details(nolio_id, athlete_id=athlete_nolio_id) 
        if not details:
            print("   ❌ Could not fetch details from Nolio.")
            continue
            
        file_url = details.get('file_url')
        if not file_url:
            print("   ⚠️ No FIT file on Nolio (Manual entry?).")
            continue

        fit_data = client.download_fit_file(file_url)
        if not fit_data:
            print("   ❌ Failed to download FIT.")
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name

        try:
            df, meta, laps = FitParser.parse(tmp_path)
            if 'heart_rate' in df.columns:
                hr_data = df['heart_rate'].dropna()
                if not hr_data.empty:
                    print(f"   ✅ FIT has HR data! Avg: {hr_data.mean():.1f} (Possible ingestion bug)")
                else:
                    print("   ❌ FIT has HR column but it's EMPTY (NaN).")
            else:
                print("   ❌ FIT has NO heart_rate column at all.")
        except Exception as e:
            print(f"   ❌ Error parsing FIT: {e}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        print("-" * 30)

if __name__ == "__main__":
    audit_null_hr()
