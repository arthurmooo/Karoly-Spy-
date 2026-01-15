import os
import sys
import hashlib
import tempfile
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.db.writer import ActivityWriter

def calculate_file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

def run_test_ingestion():
    print("=== 🧪 TEST INGESTION: Adrien Claeyssen ===")
    
    # 1. Setup
    db = DBConnector()
    nolio = NolioClient()
    
    # 2. Get Adrien's Nolio ID from DB
    res = db.client.table("athletes").select("*").eq("first_name", "Adrien").eq("last_name", "Claeyssen").single().execute()
    athlete = res.data
    nolio_id = athlete.get("nolio_id")
    athlete_db_id = athlete.get("id")
    
    print(f"Target Athlete: {athlete['first_name']} (Nolio: {nolio_id})")
    
    # 3. Define Date Range (Last 7 days)
    today = datetime.now()
    week_ago = today - timedelta(days=14) # Safety margin
    date_to = today.strftime("%Y-%m-%d")
    date_from = week_ago.strftime("%Y-%m-%d")
    
    print(f"Fetching activities from {date_from} to {date_to}...")
    
    # 4. Fetch Nolio Activities
    activities = nolio.get_activities(nolio_id, date_from, date_to)
    print(f"Found {len(activities)} activities.")
    
    # 5. Process Each Activity
    for act in activities:
        act_id = act.get("nolio_id")
        act_name = act.get("name")
        file_url = act.get("file_url")
        
        print(f"\n>> Processing: {act_name} (ID: {act_id})")
        
        if not file_url:
            print("   ⚠️ No FIT file available (Manual entry?). Skipping.")
            continue
            
        # Download
        print("   📥 Downloading FIT...")
        fit_data = nolio.download_fit_file(file_url)
        
        if not fit_data:
            print("   ❌ Download failed.")
            continue
            
        file_hash = calculate_file_hash(fit_data)
        print(f"   🔑 Hash: {file_hash}")
        
        # Check Hash in DB to prevent duplicates
        hash_check = db.client.table("activities").select("id").eq("fit_file_hash", file_hash).execute()
        if hash_check.data:
            print("   ⏭️ Duplicate file (Hash match). Skipping processing.")
            continue
            
        # Save to Temp File for Parser
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name
            
        try:
            # Parse
            print("   🧠 Parsing...")
    # 3. Parse and Calculate
    print(f"DEBUG: Processing {tmp_path}...")
    df, meta, laps = FitParser.parse(tmp_path)
    
    # Wrap in Activity logic
    activity_meta = ActivityMetadata(
        activity_type="Run", # Hardcoded for test
        start_time=df['timestamp'].iloc[0],
        duration_sec=(df['timestamp'].iloc[-1] - df['timestamp'].iloc[0]).total_seconds(),
        distance_m=None
    )
    activity = Activity(activity_meta, df, laps=laps)

            
            if meta.get('serial_number'):
                print(f"      -> Device: {meta.get('manufacturer')} {meta.get('product')} (S/N: {meta.get('serial_number')})")

            # Calculate
            print("   🧮 Calculating Karoly Load...")
            profile = ProfileManager(db).get_profile(athlete_db_id)
            metrics = MetricsCalculator.calculate(df, profile)
            
            print(f"      -> Load: {metrics.karoly_load:.1f}, NP: {metrics.normalized_power:.0f}W")
            
            # Save to DB - Using simplified manual insert for test script clarity
            # (Matches schema from Track 1.1)
            activity_payload = {
                "athlete_id": athlete_db_id,
                "nolio_id": act_id,
                "session_date": act.get("date_start"),
                "sport_type": act.get("sport", "Bike"),
                "fit_file_hash": file_hash,
                
                # Metrics
                "load_index": metrics.karoly_load,
                "durability_index": metrics.durability_index,
                "decoupling_index": metrics.aerobic_decoupling,
                "avg_power": metrics.normalized_power, # Storing NP as power metric for now or avg
                "avg_hr": metrics.avg_hr
            }
            
            db.client.table("activities").upsert(activity_payload, on_conflict="nolio_id").execute()
            print("   ✅ SAVED to Database!")
            
            # Upload to Storage
            storage_path = f"{athlete_db_id}/{datetime.now().year}/{file_hash}.fit"
            print(f"   ☁️ Uploading to Storage: {storage_path}")
            db.client.storage.from_("raw_fits").upload(storage_path, fit_data, {"content-type": "application/vnd.ant.fit"})
            
        except Exception as e:
            print(f"   ❌ Error processing: {e}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

if __name__ == "__main__":
    run_test_ingestion()