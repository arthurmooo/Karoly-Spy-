import os
import sys
import hashlib
import tempfile
import argparse
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.models import Activity, ActivityMetadata, ActivityMetrics
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.writer import ActivityWriter

def calculate_file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

class IngestionRobot:
    def __init__(self, history_days: int = 14):
        self.db = DBConnector()
        self.nolio = NolioClient()
        self.storage = StorageManager()
        self.history_days = history_days
        self.config = AthleteConfig() # Global Karoly coefficients
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)

    def sync_athletes_roster(self):
        """Fetches athletes from Nolio and ensures they exist in DB."""
        print("🔄 Syncing Athlete Roster...")
        try:
            nolio_athletes = self.nolio.get_managed_athletes()
            
            for na in nolio_athletes:
                nid = na.get('id')
                if not nid:
                    continue
                    
                # Check DB
                res = self.db.client.table("athletes").select("id").eq("nolio_id", nid).execute()
                if not res.data:
                    first = na.get('firstname', na.get('first_name', 'Unknown'))
                    last = na.get('lastname', na.get('last_name', 'Athlete'))
                    print(f"   ✨ New Athlete found: {first} {last}")
                    
                    # Create
                    self.db.client.table("athletes").insert({
                        "nolio_id": nid,
                        "first_name": first,
                        "last_name": last,
                        "email": na.get('email'),
                        "is_active": True
                    }).execute()
        except Exception as e:
            print(f"⚠️ Error syncing roster: {e}")
        
    def run(self, specific_athlete_name: Optional[str] = None):
        print(f"🚀 Starting Ingestion Robot (Window: {self.history_days} days)")
        
        # 1. Sync Roster (Discovery Phase)
        self.sync_athletes_roster()
        
        # 2. Fetch Athletes from DB who have a nolio_id
        query = self.db.client.table("athletes").select("id, first_name, last_name, nolio_id").eq("is_active", True).not_.is_("nolio_id", "null")
        if specific_athlete_name:
            query = query.ilike("first_name", f"%{specific_athlete_name}%")
        
        res = query.execute()
        athletes = res.data
        
        print(f"📊 Found {len(athletes)} athletes to sync.")
        
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        date_from = (datetime.now(timezone.utc) - timedelta(days=self.history_days)).strftime("%Y-%m-%d")

        for athlete in athletes:
            self.process_athlete(athlete, date_from, date_to)

        print("\n🏁 Ingestion Complete.")

    def process_athlete(self, athlete: Dict[str, Any], date_from: str, date_to: str):
        full_name = f"{athlete['first_name']} {athlete['last_name']}"
        athlete_uuid = athlete['id']
        nolio_id = athlete['nolio_id']
        
        print(f"\n👤 Processing: {full_name} (Nolio: {nolio_id})")
        
        try:
            activities = self.nolio.get_activities(nolio_id, date_from, date_to)
            if not activities:
                print("   ☕ No new activities found.")
                return
            
            print(f"   📂 Found {len(activities)} activities.")
            
            for act in tqdm(activities, desc=f"   Ingesting {athlete['first_name']}", leave=False):
                self.process_activity(athlete_uuid, act)
                
        except Exception as e:
            print(f"   ❌ Error for {full_name}: {e}")

    def process_activity(self, athlete_id: str, nolio_act: Dict[str, Any]):
        act_id = str(nolio_act.get("nolio_id", nolio_act.get("id"))) # Fallback to 'id' if 'nolio_id' missing
        
        if not act_id:
            return

        file_url = nolio_act.get("file_url")
        
        # 1. Skip if no file (manual entry)
        if not file_url:
            return

        # 2. Duplicate Check (Nolio ID)
        exists = self.db.client.table("activities").select("id").eq("nolio_id", act_id).execute()
        if exists.data:
            return

        # 3. Download
        fit_data = self.nolio.download_fit_file(file_url)
        if not fit_data:
            return
            
        file_hash = calculate_file_hash(fit_data)
        
        # 4. Secondary Duplicate Check (File Hash)
        hash_exists = self.db.client.table("activities").select("id").eq("fit_file_hash", file_hash).execute()
        if hash_exists.data:
            return

        # 5. Parse & Extract Metadata
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name
            
        try:
            df, device_meta, laps = FitParser.parse(tmp_path)
            
            # 6. Device Mapping Update
            if device_meta.get('serial_number'):
                sn = str(device_meta['serial_number'])
                name = f"{device_meta.get('manufacturer', '')} {device_meta.get('product', '')}".strip()
                self.db.client.table("athlete_devices").upsert({
                    "athlete_id": athlete_id,
                    "serial_number": sn,
                    "device_name": name or "Unknown Device"
                }, on_conflict="serial_number").execute()

            # 7. Calculate Metrics
            nolio_sport = nolio_act.get("sport", "Other")
            internal_sport = "Bike" if nolio_sport in ["Bike", "Road cycling", "Virtual ride", "Mountain cycling"] else "Run"
            
            start_date = df['timestamp'].iloc[0] if not df.empty else datetime.fromisoformat(nolio_act.get("date_start").replace('Z', '+00:00'))
            
            # Get athlete profile
            profile = self.profile_manager.get_profile_for_date(athlete_id, internal_sport, start_date)
            
            meta = ActivityMetadata(
                activity_type=internal_sport,
                start_time=start_date,
                duration_sec=len(df),
                rpe=nolio_act.get("rpe")
            )
            
            activity = Activity(metadata=meta, streams=df, laps=laps)
            
            if profile and not df.empty:
                metrics_dict = self.calculator.compute(activity, profile)
                activity.metrics = ActivityMetrics(**metrics_dict)
            else:
                activity.metrics = ActivityMetrics()

            # 8. Upload to Storage FIRST to get the path
            year = str(start_date.year)
            storage_path = self.storage.upload_fit_file(
                athlete_id=athlete_id,
                nolio_id=int(act_id), # Ensure int
                content=fit_data,
                year=year
            )
            
            # 9. Save to Database
            ActivityWriter.save(
                activity, 
                self.db, 
                athlete_id, 
                nolio_id=act_id, 
                file_hash=file_hash,
                file_path=storage_path
            )
            
        except Exception as e:
            print(f"      ❌ Error processing activity {act_id}: {e}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Project K Ingestion Robot")
    parser.add_argument("--days", type=int, default=14, help="Number of days to look back")
    parser.add_argument("--athlete", type=str, help="Filter by athlete first name")
    
    args = parser.parse_args()
    
    robot = IngestionRobot(history_days=args.days)
    robot.run(specific_athlete_name=args.athlete)
