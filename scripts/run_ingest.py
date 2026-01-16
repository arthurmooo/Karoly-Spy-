import os
import sys
import hashlib
import tempfile
import argparse
import pandas as pd
import logging
from datetime import datetime, timedelta, timezone

# Setup logging
log = logging.getLogger(__name__)
from typing import List, Dict, Any, Optional
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.integrations.storage import StorageManager
from projectk_core.integrations.weather import WeatherClient
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.classifier import ActivityClassifier
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
        self.weather = WeatherClient()
        self.history_days = history_days
        self.config = AthleteConfig() # Global Karoly coefficients
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)
        self.classifier = ActivityClassifier()

    def sync_athletes_roster(self):
        """Fetches athletes from Nolio and ensures they exist in DB with their metrics."""
        print("🔄 Syncing Athlete Roster & Metrics...")
        try:
            nolio_athletes = self.nolio.get_managed_athletes()
            
            for na in nolio_athletes:
                nid = na.get('nolio_id', na.get('id'))
                if not nid:
                    continue
                    
                # 1. Check/Create Athlete
                res = self.db.client.table("athletes").select("id").eq("nolio_id", nid).execute()
                if not res.data:
                    full_name = na.get('name', '')
                    if full_name and ' ' in full_name:
                        first, last = full_name.split(' ', 1)
                    else:
                        first = na.get('firstname', na.get('first_name', full_name or 'Unknown'))
                        last = na.get('lastname', na.get('last_name', 'Athlete'))
                    
                    print(f"   ✨ New Athlete found: {first} {last}")
                    res = self.db.client.table("athletes").insert({
                        "nolio_id": nid,
                        "first_name": first,
                        "last_name": last,
                        "is_active": True
                    }).execute()
                
                athlete_uuid = res.data[0]['id']

                # 2. Sync Metrics (CP/CS/Weight)
                print(f"   📊 Syncing Metrics for {na.get('name')}...")
                metrics = self.nolio.get_athlete_metrics(nid)
                
                cp_val = None
                cs_val = None
                weight_val = None
                
                if 'criticalpowercycling' in metrics and metrics['criticalpowercycling'].get('data'):
                    cp_val = metrics['criticalpowercycling']['data'][0].get('value')
                
                if 'criticalspeedrunning' in metrics and metrics['criticalspeedrunning'].get('data'):
                    raw_cs = metrics['criticalspeedrunning']['data'][0].get('value')
                    if raw_cs:
                        cs_val = 1000.0 / float(raw_cs)

                if 'weight' in metrics and metrics['weight'].get('data'):
                    weight_val = metrics['weight']['data'][0].get('value')

                # 3. Update Physio Profile (SCD Type 2)
                existing_profile = self.profile_manager.get_profile_for_date(athlete_uuid, "Bike", datetime.now(timezone.utc))
                
                # Check for changes in CP or Weight
                # Note: existing_profile is now a PhysioProfile object
                old_cp = float(existing_profile.lt2_power_pace or 0) if existing_profile else 0
                old_weight = float(existing_profile.weight or 0) if existing_profile else 0
                
                cp_changed = cp_val and (not existing_profile or abs(old_cp - float(cp_val)) > 1)
                weight_changed = weight_val and (not existing_profile or abs(old_weight - float(weight_val)) > 0.1)

                if cp_changed or weight_changed:
                    # If it's the first profile, we date it far in the past to cover history
                    v_from = "2000-01-01T00:00:00+00:00" if not existing_profile else datetime.now(timezone.utc).isoformat()
                    
                    print(f"      🆕 Update detected (Bike): CP={cp_val}W, Weight={weight_val}kg (Valid from: {v_from[:10]})")
                    self.db.client.table("physio_profiles").insert({
                        "athlete_id": athlete_uuid,
                        "sport": "Bike",
                        "lt2_power_pace": cp_val,
                        "weight": weight_val,
                        "lt1_hr": existing_profile.lt1_hr if existing_profile else 130,
                        "lt2_hr": existing_profile.lt2_hr if existing_profile else 160,
                        "valid_from": v_from
                    }).execute()

                # Same for Run
                existing_run_profile = self.profile_manager.get_profile_for_date(athlete_uuid, "Run", datetime.now(timezone.utc))
                old_cs = float(existing_run_profile.lt2_power_pace or 0) if existing_run_profile else 0
                cs_changed = cs_val and (not existing_run_profile or abs(old_cs - float(cs_val)) > 0.1)
                
                if cs_changed or weight_changed:
                    v_from_run = "2000-01-01T00:00:00+00:00" if not existing_run_profile else datetime.now(timezone.utc).isoformat()
                    
                    print(f"      🆕 Update detected (Run): CS={round(cs_val, 2) if cs_val else '-'}m/s, Weight={weight_val}kg (Valid from: {v_from_run[:10]})")
                    self.db.client.table("physio_profiles").insert({
                        "athlete_id": athlete_uuid,
                        "sport": "Run",
                        "lt2_power_pace": cs_val,
                        "weight": weight_val,
                        "lt1_hr": existing_run_profile.lt1_hr if existing_run_profile else 130,
                        "lt2_hr": existing_run_profile.lt2_hr if existing_run_profile else 160,
                        "valid_from": v_from_run
                    }).execute()

        except Exception as e:
            print(f"⚠️ Error syncing roster & metrics: {e}")
            log.exception("Sync error detail")
        
    def run(self, specific_athlete_name: Optional[str] = None):
        print(f"🚀 Starting Ingestion Robot (Window: {self.history_days} days)")
        
        # 1. Sync Roster (Discovery Phase)
        self.sync_athletes_roster()

        # 2. Process Webhooks first (Priority)
        self.process_webhooks()
        
        # 3. Fetch Athletes from DB who have a nolio_id
        query = self.db.client.table("athletes").select("id, first_name, last_name, nolio_id").eq("is_active", True).not_.is_("nolio_id", "null")
        if specific_athlete_name:
            query = query.ilike("first_name", f"%{specific_athlete_name}%")
        
        res = query.execute()
        athletes = res.data
        
        print(f"📊 Running scheduled scan for {len(athletes)} athletes.")
        
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        date_from = (datetime.now(timezone.utc) - timedelta(days=self.history_days)).strftime("%Y-%m-%d")

        for athlete in athletes:
            self.process_athlete(athlete, date_from, date_to)

        print("\n🏁 Ingestion Complete.")

    def process_webhooks(self):
        """Processes pending webhook events from Nolio."""
        print("🔗 Checking for Webhook events...")
        try:
            res = self.db.client.table("webhook_events")\
                .select("*")\
                .eq("processed", False)\
                .eq("provider", "nolio")\
                .execute()
            
            events = res.data
            if not events:
                print("   ✅ No new webhook events.")
                return

            print(f"   🔔 Found {len(events)} pending events.")
            
            for event in events:
                payload = event.get("payload", {})
                event_id = event["id"]
                
                # Nolio Achievement Webhook format:
                # { "user_id": 123, "workout_id": 456, "event": "achievement" }
                nolio_user_id = payload.get("user_id")
                workout_id = payload.get("workout_id")
                
                if not nolio_user_id or not workout_id:
                    print(f"      ⚠️ Invalid payload for event {event_id}")
                    self.db.client.table("webhook_events").update({"processed": True, "error_message": "Invalid payload"}).eq("id", event_id).execute()
                    continue

                # Find athlete UUID
                ath_res = self.db.client.table("athletes").select("id").eq("nolio_id", nolio_user_id).execute()
                if not ath_res.data:
                    print(f"      ⚠️ Athlete Nolio:{nolio_user_id} not found in DB.")
                    self.db.client.table("webhook_events").update({"processed": True, "error_message": "Athlete not found"}).eq("id", event_id).execute()
                    continue
                
                athlete_uuid = ath_res.data[0]["id"]
                
                # Fetch full activity details from Nolio API
                print(f"      📥 Processing Webhook Workout: {workout_id} for Athlete {nolio_user_id}")
                try:
                    nolio_act = self.nolio.get_activity_details(workout_id)
                    if nolio_act:
                        self.process_activity(athlete_uuid, nolio_act)
                    
                    # Mark as processed
                    self.db.client.table("webhook_events").update({"processed": True}).eq("id", event_id).execute()
                except Exception as e:
                    print(f"      ❌ Error processing webhook workout {workout_id}: {e}")
                    self.db.client.table("webhook_events").update({"error_message": str(e)}).eq("id", event_id).execute()

        except Exception as e:
            print(f"⚠️ Error in process_webhooks: {e}")

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
            
            pbar = tqdm(activities, desc=f"   Ingesting {athlete['first_name']}", leave=False)
            for act in pbar:
                self.process_activity(athlete_uuid, act)
            pbar.close() # Ensure bar finishes and cleans up display
                
        except Exception as e:
            print(f"   ❌ Error for {full_name}: {e}")

    def process_activity(self, athlete_id: str, nolio_act: Dict[str, Any]):
        act_id = str(nolio_act.get("nolio_id", nolio_act.get("id")))
        if not act_id:
            return

        # 1. Duplicate Check (Nolio ID)
        exists = self.db.client.table("activities").select("id").eq("nolio_id", act_id).execute()
        if exists.data:
            return

        print(f"      📥 Ingesting Activity: {act_id} ({nolio_act.get('sport', 'Other')})")

        # 2. Extract Basic Metadata from Nolio (Safe Defaults)
        nolio_sport = nolio_act.get("sport", "Other")
        internal_sport = "Bike" if nolio_sport in ["Bike", "Road cycling", "Virtual ride", "Mountain cycling"] else "Run"
        
        try:
            start_date_raw = nolio_act.get("date_start", "").replace('Z', '+00:00')
            start_date = datetime.fromisoformat(start_date_raw) if start_date_raw else datetime.now(timezone.utc)
        except:
            start_date = datetime.now(timezone.utc)

        duration_sec = float(nolio_act.get("duration_total", nolio_act.get("duration", 0)))
        distance_m = float(nolio_act.get("distance", 0))
        rpe = nolio_act.get("rpe")
        
        meta = ActivityMetadata(
            activity_type=internal_sport,
            start_time=start_date,
            duration_sec=max(1.0, duration_sec), # Pydantic gt=0
            distance_m=distance_m,
            rpe=rpe
        )

        # 3. Try to process FIT data if available
        fit_data = None
        file_hash = None
        storage_path = None
        df = pd.DataFrame()
        laps = []
        
        file_url = nolio_act.get("file_url")
        if file_url:
            fit_data = self.nolio.download_fit_file(file_url)
            if fit_data:
                file_hash = calculate_file_hash(fit_data)
                
                # Check for hash duplicate
                hash_exists = self.db.client.table("activities").select("id").eq("fit_file_hash", file_hash).execute()
                if hash_exists.data:
                    return

                # Parse FIT
                with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                    tmp.write(fit_data)
                    tmp_path = tmp.name
                
                try:
                    df, device_meta, laps = FitParser.parse(tmp_path)
                    
                    # Fetch Weather (API)
                    if not df.empty and 'lat' in df.columns and 'lon' in df.columns:
                        valid_coords = df[['lat', 'lon']].dropna().iloc[:1]
                        if not valid_coords.empty:
                            lat, lon = float(valid_coords['lat'].iloc[0]), float(valid_coords['lon'].iloc[0])
                            w = self.weather.get_weather_at_timestamp(lat, lon, start_date)
                            if w:
                                meta.temp_avg = w.get("temp")
                                meta.humidity_avg = w.get("humidity")
                                meta.weather_source = "openweathermap"

                    # Device Mapping
                    if device_meta.get('serial_number'):
                        sn = str(device_meta['serial_number'])
                        name = f"{device_meta.get('manufacturer', '')} {device_meta.get('product', '')}".strip()
                        self.db.client.table("athlete_devices").upsert({
                            "athlete_id": athlete_id,
                            "serial_number": sn,
                            "device_name": name or "Unknown Device"
                        }, on_conflict="serial_number").execute()
                        
                except Exception as e:
                    print(f"      ⚠️ FIT Parsing failed for {act_id} (using metadata only): {e}")
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)

        # 4. Detect Work Type
        activity_title = nolio_act.get("name", "")
        meta.work_type = self.classifier.detect_work_type(df, activity_title, nolio_sport)

        # 5. Create Activity Object
        activity = Activity(metadata=meta, streams=df, laps=laps)
        
        # 6. Calculate Metrics
        # Mode A: Advanced Calculation (if we have a profile and streams)
        profile = self.profile_manager.get_profile_for_date(athlete_id, internal_sport, start_date)
        
        if profile and not df.empty:
            metrics_dict = self.calculator.compute(activity, profile)
            
            # Security: Ensure interval metrics are ONLY present for intervals work_type
            if meta.work_type != "intervals":
                interval_keys = ["interval_power_last", "interval_hr_last", "interval_power_mean", "interval_hr_mean"]
                for k in interval_keys:
                    metrics_dict.pop(k, None)
            
            activity.metrics = ActivityMetrics(**metrics_dict)
        else:
            # Mode B: Degraded Mode (Metadata only)
            # Basic Load = RPE * (Duration in minutes) if RPE exists
            load = None
            if rpe and duration_sec:
                load = float(rpe) * (duration_sec / 60.0)
            
            activity.metrics = ActivityMetrics(mls_load=load)

        # 7. Storage Upload
        if fit_data:
            try:
                year = str(start_date.year)
                storage_path = self.storage.upload_fit_file(
                    athlete_id=athlete_id,
                    nolio_id=int(act_id),
                    content=fit_data,
                    year=year
                )
            except Exception as e:
                print(f"      ⚠️ Storage upload failed: {e}")

        # 8. Final Save
        try:
            ActivityWriter.save(
                activity, 
                self.db, 
                athlete_id, 
                nolio_id=act_id, 
                file_hash=file_hash,
                file_path=storage_path
            )
        except Exception as e:
            print(f"      ❌ Final DB Save failed for {act_id}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Project K Ingestion Robot")
    parser.add_argument("--days", type=int, default=14, help="Number of days to look back")
    parser.add_argument("--athlete", type=str, help="Filter by athlete first name")
    
    args = parser.parse_args()
    
    robot = IngestionRobot(history_days=args.days)
    robot.run(specific_athlete_name=args.athlete)
