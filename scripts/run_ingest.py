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
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.readiness import ReadinessCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.logic.models import Activity, ActivityMetadata, ActivityMetrics
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.writer import ActivityWriter

def calculate_file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

class IngestionRobot:
    def __init__(self, history_days: int = 14, enable_writeback: bool = False, force_refresh: bool = False):
        self.db = DBConnector()
        self.nolio = NolioClient()
        self.storage = StorageManager()
        self.weather = WeatherClient()
        self.history_days = history_days
        self.enable_writeback = enable_writeback
        self.force_refresh = force_refresh
        self.config = AthleteConfig() # Global Karoly coefficients
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)
        self.classifier = ActivityClassifier()
        self.plan_parser = NolioPlanParser()
        self.readiness_calc = ReadinessCalculator(self.db)

    def sync_athletes_roster(self, force_metrics: bool = False, specific_athlete_name: Optional[str] = None):
        """
        Fetches athletes from Nolio and ensures they exist in DB.
        Syncs physiological metrics ONLY during the night run (02:00-04:00 UTC) or if forced.
        """
        current_hour = datetime.now(timezone.utc).hour
        # On définit la fenêtre de synchro profonde (ex: 2h du matin UTC)
        is_main_run = (2 <= current_hour <= 4) or force_metrics
        
        print(f"🔄 Syncing Athlete Roster (Metrics sync: {'ENABLED' if is_main_run else 'SKIPPED for quota'})")
        try:
            nolio_athletes = self.nolio.get_managed_athletes()
            
            for na in nolio_athletes:
                nid = na.get('nolio_id', na.get('id'))
                if not nid:
                    continue
                
                # Filter by name if requested
                athlete_name = na.get('name', '')
                if specific_athlete_name and specific_athlete_name.lower() not in athlete_name.lower():
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

                # 2. Sync Metrics (CP, CS, Weight, VO2max) - ONLY during main run
                if not is_main_run:
                    continue

                print(f"   📊 Syncing metrics from Nolio for {na.get('name')}...")
                try:
                    meta = self.nolio.get_athlete_metrics(nid)
                    
                    # Extraction des valeurs clés
                    # Nolio structure: {"field_name": {"unit": "...", "data": [{"value": X, "date": "..."}]}}
                    def get_latest(key):
                        field = meta.get(key, {})
                        data = field.get("data", [])
                        return data[0]["value"] if data else None

                    weight = get_latest("weight")
                    cp_bike = get_latest("criticalpowercycling")
                    cs_run_raw = get_latest("criticalspeedrunning") # in sec/km or min/km
                    rmssd = get_latest("rmssd")
                    resting_hr = get_latest("restinghr")
                    
                    # 2.1 Sync HRV (Daily Readiness)
                    if rmssd or resting_hr:
                        print(f"      💓 Syncing HRV for {na.get('name')}...")
                        self.db.client.table("daily_readiness").upsert({
                            "athlete_id": athlete_uuid,
                            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "rmssd": rmssd,
                            "resting_hr": resting_hr
                        }, on_conflict="athlete_id, date").execute()

                    # Conversion CS: sec/km -> m/s
                    cs_run = None
                    if cs_run_raw:
                        # Si Adrien est à 206s/km -> 1000 / 206 = 4.85 m/s
                        cs_run = 1000.0 / float(cs_run_raw) if float(cs_run_raw) > 0 else None

                    # Champs personnalisés Karoly (à créer par lui dans Nolio)
                    # Plus de valeurs par défaut (130/160) -> On veut du Null si pas renseigné
                    lt1_hr = get_latest("K_LT1_HR") or get_latest("k_lt1_hr")
                    lt2_hr = get_latest("K_LT2_HR") or get_latest("k_lt2_hr")

                    # 2.2 Mise à jour HISTORISÉE des profils (SCD Type 2)
                    if lt1_hr and lt2_hr:
                        self._sync_physio_profile(athlete_uuid, "Bike", cp_bike, weight, lt1_hr, lt2_hr)
                        self._sync_physio_profile(athlete_uuid, "Run", cs_run, weight, lt1_hr, lt2_hr)
                    else:
                        print(f"      ⚠️ Missing LT1/LT2 for {na.get('name')}. Skipping profile sync (Metrics will be NULL).")
                    
                    cs_display = f"{cs_run:.2f}" if cs_run else "None"
                    print(f"      ✅ Metrics synced: CP={cp_bike}W, CS={cs_display}m/s, Weight={weight}kg")

                    # 3. Sync Daily Health Readiness (RMSSD, Sleep, RHR)
                    print(f"      ❤️ Syncing health readiness for {na.get('name')}...")
                    health_data = self.nolio.get_athlete_health_metrics(nid, days=self.history_days)
                    for day_str, metrics in health_data.items():
                        self.db.client.table("daily_readiness").upsert({
                            "athlete_id": athlete_uuid,
                            "date": day_str,
                            "rmssd": metrics.get("rmssd"),
                            "resting_hr": metrics.get("resting_hr"),
                            "sleep_duration": metrics.get("sleep_duration"),
                            "sleep_score": metrics.get("sleep_score")
                        }, on_conflict="athlete_id, date").execute()
                    
                    if health_data:
                        print(f"      ✅ Health data synced for {len(health_data)} days.")
                        
                        # 4. Update Baselines (30d rolling averages)
                        print(f"      📈 Updating physiological baselines for {na.get('name')}...")
                        baselines = self.readiness_calc.calculate_baselines(athlete_uuid, datetime.now(timezone.utc).date())
                        
                        # Apply baselines to the most recent entry (today)
                        self.db.client.table("daily_readiness").upsert({
                            "athlete_id": athlete_uuid,
                            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "rmssd_30d_avg": baselines.get("rmssd_30d_avg"),
                            "resting_hr_30d_avg": baselines.get("resting_hr_30d_avg")
                        }, on_conflict="athlete_id, date").execute()
                        print(f"      ✅ Baselines updated: RMSSD_30d={baselines.get('rmssd_30d_avg')}ms, RHR_30d={baselines.get('resting_hr_30d_avg')}bpm")

                except Exception as e:
                    print(f"      ⚠️ Could not sync metrics from Nolio for {nid}: {e}")

        except Exception as e:
            print(f"⚠️ Error during athlete discovery: {e}")
            log.exception("Discovery error detail")
        
    def _sync_physio_profile(self, athlete_id: str, sport: str, cp_cs: Optional[float], weight: Optional[float], lt1_hr: float, lt2_hr: float):
        """
        Implements SCD Type 2 for physiological profiles.
        If any threshold changes, it closes the current profile and creates a new one.
        """
        if cp_cs is None and weight is None:
            return # Skip if no data
            
        # 1. Fetch current active profile
        res = self.db.client.table("physio_profiles")\
            .select("*")\
            .eq("athlete_id", athlete_id)\
            .eq("sport", sport)\
            .is_("valid_to", "null")\
            .order("valid_from", desc=True)\
            .limit(1)\
            .execute()
        
        current = res.data[0] if res.data else None
        
        def is_diff(v1, v2, tol=0.1):
            if v1 is None and v2 is None: return False
            if v1 is None or v2 is None: return True
            return abs(float(v1) - float(v2)) > tol

        # 2. Compare
        has_changed = False
        if current:
            has_changed = (
                is_diff(current.get('cp_cs'), cp_cs) or
                is_diff(current.get('weight'), weight) or
                is_diff(current.get('lt1_hr'), lt1_hr) or
                is_diff(current.get('lt2_hr'), lt2_hr)
            )
        else:
            has_changed = True # First time entry

        if has_changed:
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # 3. Close old profile if it exists
            if current:
                print(f"         📉 Thresholds changed for {sport}. Archiving old profile.")
                self.db.client.table("physio_profiles")\
                    .update({"valid_to": now_iso})\
                    .eq("id", current['id'])\
                    .execute()
            
            # 4. Create new profile
            # If it's the first one, we use the 2000-01-01 date to cover history
            valid_from = "2000-01-01T00:00:00Z" if not current else now_iso
            
            self.db.client.table("physio_profiles").insert({
                "athlete_id": athlete_id,
                "sport": sport,
                "cp_cs": cp_cs,
                "weight": weight,
                "lt1_hr": lt1_hr,
                "lt2_hr": lt2_hr,
                "valid_from": valid_from
            }).execute()
            print(f"         ✨ New {sport} profile created (valid from {valid_from[:10]})")

    def run(self, specific_athlete_name: Optional[str] = None, force_metrics: bool = False):
        print(f"🚀 Starting Ingestion Robot (Window: {self.history_days} days)")
        
        # 1. Sync Roster (Discovery Phase)
        self.sync_athletes_roster(force_metrics=force_metrics, specific_athlete_name=specific_athlete_name)

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
            # 4. Anti-Rate Limit: Small pause between athletes
            import time
            time.sleep(1.0)
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
                    nolio_act = self.nolio.get_activity_details(workout_id, athlete_id=nolio_user_id)
                    if nolio_act:
                        self.process_activity(athlete_uuid, nolio_act, athlete_nolio_id=nolio_user_id)
                    
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
        try:
            nolio_id = int(athlete['nolio_id'])
        except (ValueError, TypeError):
            print(f"   ⚠️ Invalid Nolio ID for {full_name}: {athlete.get('nolio_id')}")
            return
        
        print(f"\n👤 Processing: {full_name} (Nolio: {nolio_id})")
        
        try:
            activities = self.nolio.get_activities(nolio_id, date_from, date_to)
            if not activities:
                print("   ☕ No new activities found.")
                return
            
            print(f"   📂 Found {len(activities)} activities.")
            
            pbar = tqdm(activities, desc=f"   Ingesting {athlete['first_name']}", leave=False)
            for act in pbar:
                self.process_activity(athlete_uuid, act, athlete_nolio_id=nolio_id)
            pbar.close() # Ensure bar finishes and cleans up display
                
        except Exception as e:
            print(f"   ❌ Error for {full_name}: {e}")

    def process_activity(self, athlete_id: str, nolio_act: Dict[str, Any], athlete_nolio_id: Optional[int] = None):
        act_id = str(nolio_act.get("nolio_id", nolio_act.get("id")))
        if not act_id:
            return

        # 1. Duplicate Check (Nolio ID) - Allow refresh if critical data or FIT file is missing
        exists = self.db.client.table("activities").select("id, duration_sec, distance_m, sport_type, fit_file_path").eq("nolio_id", act_id).execute()
        if exists.data:
            rec = exists.data[0]
            dist = rec.get("distance_m")
            dur = rec.get("duration_sec")
            sport = rec.get("sport_type")
            has_fit = rec.get("fit_file_path") is not None
            
            # Condition for refresh:
            # - Missing duration or distance
            # - Missing FIT file (if it's a sport that should have one)
            # - OR Distance looks like KM (e.g. < 200m for a Run/Bike, which is very unlikely unless it's a test)
            is_missing = (dur is None or dist is None)
            is_missing_fit = not has_fit and sport in ['Run', 'Bike', 'Swim']
            is_probably_km = (dist is not None and 0 < dist < 300 and sport in ['Run', 'Bike'])
            
            if not (is_missing or is_missing_fit or is_probably_km or self.force_refresh):
                return
                
            reason = "Force refresh" if self.force_refresh else (
                "Missing data" if is_missing else (
                    "Missing FIT file" if is_missing_fit else "Distance unit mismatch (KM?)"
                )
            )
            print(f"      🔄 Refreshing Activity {act_id}: {reason}")

        print(f"      📥 Ingesting Activity: {act_id} ({nolio_act.get('sport', 'Other')})")

        # 0. Plan Retrieval (Planned Structure)
        target_grid = None
        planned_id = nolio_act.get("planned_id")
        planned_session = None
        
        if planned_id:
            planned_session = self.nolio.get_planned_workout_by_id(planned_id, athlete_id=athlete_nolio_id)
        
        # Fallback: Search in same week if no direct link
        if not planned_session:
            # We use the start_date of the activity to search around
            # But we need start_date which is parsed below. 
            # I'll move this logic after basic metadata extraction.
            pass

        # 2. Extract Basic Metadata from Nolio (Safe Defaults)
        nolio_sport = nolio_act.get("sport", "Other")
        
        # Robust Mapping for Nolio Sports (French & English)
        # Order matters here for priority
        sport_map = {
            "Bike": ["Vélo", "Cyclisme", "VTT", "Cycling", "Biking", "Road cycling", "Virtual ride", "Mountain cycling", "Gravel"],
            "Swim": ["Natation", "Swimming", "Nage"],
            "Strength": ["Renforcement musculaire", "Musculation", "PPG", "Strength", "Marche", "Gainage"],
            "Run": ["Course à pied", "Running", "Trail", "Jogging", "Ski de randonnée", "Ski de fond", "Randonnée", "Rando"]
        }
        
        internal_sport = "Other"
        nolio_sport_lower = nolio_sport.lower()
        
        # Priority check: Bike/Strength first, then Swim, then Run
        found_category = None
        for category in ["Bike", "Strength", "Swim", "Run"]:
            keywords = sport_map[category]
            for kw in keywords:
                if kw.lower() in nolio_sport_lower:
                    found_category = category
                    # print(f"         🔍 Sport Match: '{nolio_sport}' -> {category} (via '{kw}')")
                    break
            if found_category:
                break
        
        internal_sport = found_category or "Other"
        
        # VERBOSE DEBUG FOR LUCAS OR OTHERS
        if act_id == "89867151" or internal_sport == "Other" or nolio_sport == "Other":
            print(f"      🕵️ DEBUG act_id:{act_id} | nolio_sport: '{nolio_sport}' | internal: {internal_sport}")
            if act_id == "89867151":
                 print(f"      🕵️ FULL DATA for 89867151: {nolio_act}")
        
        try:
            start_date_raw = nolio_act.get("date_start", "").replace('Z', '+00:00')
            start_date = datetime.fromisoformat(start_date_raw) if start_date_raw else datetime.now(timezone.utc)
        except:
            start_date = datetime.now(timezone.utc)

        duration_sec = float(nolio_act.get("duration_total", nolio_act.get("duration", 0)))
        
        # Nolio distance is usually in KM, we need meters
        distance_raw = float(nolio_act.get("distance", 0))
        
        # Heuristic: if distance is small (< 300) and duration is significant, it's definitely KM
        # If distance is already > 300, it might be meters (unlikely from Nolio, but safety first)
        if 0 < distance_raw < 300:
            distance_m = distance_raw * 1000.0
        else:
            # Either 0, or already in meters
            distance_m = distance_raw
            
        elevation_gain = float(nolio_act.get("elevation_pos", nolio_act.get("elevation_gain", 0)))
        rpe = nolio_act.get("rpe")
        
        meta = ActivityMetadata(
            activity_type=internal_sport,
            activity_name=nolio_act.get("name"),
            source_sport=nolio_sport,
            start_time=start_date,
            duration_sec=max(1.0, duration_sec), # Pydantic gt=0
            distance_m=float(distance_m),
            elevation_gain=elevation_gain,
            rpe=rpe
        )
        
        if distance_raw > 0:
            print(f"      📏 Distance: {distance_raw} km -> {distance_m} m")

        # 0. Plan Retrieval (Planned Structure) - Continued
        if not planned_session:
            # Fallback fuzzy search within the same week
            activity_title = nolio_act.get("name", "")
            planned_session = self.nolio.find_planned_workout(
                athlete_id=nolio_act.get("user_id"), 
                date=start_date, 
                title_filter=activity_title
            )
        
        if planned_session and "structured_workout" in planned_session:
            target_grid = self.plan_parser.parse(planned_session["structured_workout"])
            if target_grid:
                print(f"         🎯 Linked to Plan: {planned_session.get('name')} ({len(target_grid)} work intervals)")

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
                if hash_exists.data and not self.force_refresh:
                    return

                # Parse FIT
                with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                    tmp.write(fit_data)
                    tmp_path = tmp.name
                
                try:
                    df, device_meta, laps = FitParser.parse(tmp_path)
                    
                    # Update start_time with high precision from FIT if available
                    if device_meta.get('start_time'):
                        start_date = device_meta['start_time']
                        # Ensure timezone awareness (FIT is UTC)
                        if start_date.tzinfo is None:
                            start_date = start_date.replace(tzinfo=timezone.utc)
                        meta.start_time = start_date
                    
                    # Update elevation if FIT has better data
                    if device_meta.get('total_ascent'):
                        meta.elevation_gain = float(device_meta['total_ascent'])
                    
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
        is_comp = nolio_act.get("is_competition", False)
        meta.work_type = self.classifier.detect_work_type(df, activity_title, nolio_sport, is_competition_nolio=is_comp)

        # 5. Create Activity Object
        activity = Activity(metadata=meta, streams=df, laps=laps)
        
        # 6. Calculate Metrics
        # Mode A: Advanced Calculation (if we have streams, even without profile)
        profile = self.profile_manager.get_profile_for_date(athlete_id, internal_sport, start_date)
        
        if not df.empty:
            # We pass nolio metadata for smart segmentation
            metrics_dict = self.calculator.compute(
                activity, 
                profile, 
                nolio_type=nolio_act.get("type"), 
                nolio_comment=nolio_act.get("comment"),
                target_grid=target_grid,
                is_competition_nolio=is_comp
            )
            
            # Security: Ensure interval metrics are ONLY present for intervals work_type
            if meta.work_type != "intervals":
                interval_keys = ["interval_power_last", "interval_hr_last", "interval_power_mean", "interval_hr_mean"]
                for k in interval_keys:
                    metrics_dict.pop(k, None)
            
            activity.metrics = ActivityMetrics(**metrics_dict)
            
            # 6.1 Write-back to Nolio (Optional)
            if self.enable_writeback and activity.metrics.mls_load:
                load_val = activity.metrics.mls_load
                dur_val = activity.metrics.dur_index
                
                # Format a clean, professional comment for Karoly
                # Example: "📊 [Project K] Karoly Load: 142.5 | Durability: 1.05"
                new_comment = f"📊 [Project K] Karoly Load: {load_val:.1f} | Durabilité: {dur_val:.2f}"
                
                # Check if we should append or overwrite
                existing_comment = nolio_act.get("description", "")
                if existing_comment and "[Project K]" not in existing_comment:
                    final_comment = f"{existing_comment}\n\n{new_comment}"
                elif "[Project K]" in existing_comment:
                    # Logic to replace old Project K info if it exists (for re-runs)
                    import re
                    final_comment = re.sub(r"📊 \[Project K\].*", new_comment, existing_comment)
                else:
                    final_comment = new_comment
                
                success = self.nolio.update_activity_comment(
                    int(act_id), 
                    final_comment, 
                    athlete_id=athlete_nolio_id
                )
                if success:
                    print(f"         📝 Nolio Comment Updated: {new_comment}")

        else:
            # Mode B: Degraded Mode (Metadata only)
            # Karoly 2026-01-22: Only Run/Bike should have a load fallback.
            # Leave others (Swim, Strength, etc.) empty.
            load = None
            if internal_sport in ["Run", "Bike"] and rpe and duration_sec:
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
    parser.add_argument("--writeback", action="store_true", help="Enable writing scores back to Nolio comments")
    parser.add_argument("--force", action="store_true", help="Force metrics and health sync regardless of hour")
    parser.add_argument("--force-refresh", action="store_true", help="Force re-processing of existing activities")
    
    args = parser.parse_args()
    
    robot = IngestionRobot(history_days=args.days, enable_writeback=args.writeback, force_refresh=args.force_refresh)
    robot.run(specific_athlete_name=args.athlete, force_metrics=args.force)
