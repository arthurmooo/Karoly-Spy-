#!/usr/bin/env python3
"""
Reprocess Interval Metrics from Storage

This script reprocesses activities that have missing interval metrics (HR=0, Power=NULL, Pace=NULL)
by downloading the .fit files from Supabase storage and recalculating the metrics.

NO NOLIO API CALLS are made - this is purely offline reprocessing.
"""

import os
import sys
import tempfile
import argparse
from datetime import datetime, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# --- CONFIGURATION ---
TARGET_ATHLETE_NAME = "Richard" # Filter by last name
TARGET_DATE_FROM = "2026-01-01"

# ⚠️ DANGER ZONE : Set to True to actually update DB
ENABLE_DB_UPDATE = True
# ---------------------

# Manual .env loading to avoid dependency issues
def load_env_manual():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ[key] = val.strip().strip('"').strip("'")

load_env_manual()

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.writer import ActivityWriter

def main(dry_run: bool = False, limit: int = 50):
    db = DBConnector()
    storage = StorageManager()
    config = AthleteConfig()
    calculator = MetricsCalculator(config)
    profile_manager = ProfileManager(db)
    classifier = ActivityClassifier()
    
    print(f"🔍 Finding activities for {TARGET_ATHLETE_NAME} since {TARGET_DATE_FROM}...")
    
    # 1. Find Athlete ID
    ath_res = db.client.table("athletes").select("id").eq("last_name", TARGET_ATHLETE_NAME).execute()
    if not ath_res.data:
        print(f"❌ Athlete {TARGET_ATHLETE_NAME} not found.")
        return
    athlete_id = ath_res.data[0]['id']
    
    # 2. Find activities
    query = db.client.table("activities").select(
        "id, nolio_id, athlete_id, session_date, sport_type, source_sport, activity_name, "
        "fit_file_path, work_type, interval_hr_last, interval_power_last, interval_pace_last, "
        "duration_sec, distance_m, elevation_gain, rpe, segmented_metrics"
    ).eq("athlete_id", athlete_id).gte("session_date", TARGET_DATE_FROM).not_.is_("fit_file_path", "null")
    
    res = query.limit(limit).execute()
    all_activities = res.data
    
    print(f"📊 Found {len(all_activities)} activities to reprocess.")
    
    if not all_activities:
        return
    
    if dry_run or not ENABLE_DB_UPDATE:
        print("\n🔍 DRY RUN / READ ONLY - Would reprocess these activities:")
        for a in all_activities:
            print(f"   - {a['session_date'][:10]} | {a['activity_name']} ({a['sport_type']})")
        if not dry_run:
            print("\n⚠️  ENABLE_DB_UPDATE is False. No changes made.")
        return
    
    # Process each activity
    success_count = 0
    error_count = 0
    
    for i, act in enumerate(all_activities):
        act_id = act['id']
        nolio_id = act['nolio_id']
        fit_path = act['fit_file_path']
        sport_type = act['sport_type']
        
        print(f"\n[{i+1}/{len(all_activities)}] 📥 Reprocessing: {act['activity_name']} ({act['session_date'][:10]})")
        
        try:
            # 1. Download .fit from storage
            fit_data = storage.download_fit_file(fit_path)
            if not fit_data:
                print(f"   ⚠️ Could not download {fit_path}")
                error_count += 1
                continue
            
            # 2. Save to temp file and parse
            with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name
            
            try:
                df, device_meta, laps = UniversalParser.parse(tmp_path)
            finally:
                os.remove(tmp_path)
            
            if df.empty:
                print(f"   ⚠️ Empty dataframe after parsing")
                error_count += 1
                continue
            
            # 3. Build Activity object
            try:
                session_date = datetime.fromisoformat(act['session_date'].replace('Z', '+00:00'))
            except:
                session_date = datetime.now(timezone.utc)
            
            meta = ActivityMetadata(
                activity_type=sport_type,
                activity_name=act['activity_name'],
                source_sport=act.get('source_sport'),
                start_time=session_date,
                duration_sec=float(act.get('duration_sec') or len(df)),
                distance_m=float(act.get('distance_m') or 0),
                elevation_gain=float(act.get('elevation_gain') or 0),
                rpe=act.get('rpe'),
                work_type=act.get('work_type', 'endurance') # preserve existing work_type if possible
            )
            
            activity = Activity(metadata=meta, streams=df, laps=laps)
            
            # 4. Get athlete profile (NOW SPORT SPECIFIC)
            profile = profile_manager.get_profile_for_date(athlete_id, sport_type, session_date)
            if profile:
                print(f"   👤 Profile Loaded: {profile.sport} (CP={profile.cp}, LT2={profile.lt2_hr})")
            else:
                print(f"   ⚠️ No profile found for {sport_type}")
            
            # 5. Recalculate metrics
            metrics_dict = calculator.compute(activity, profile)
            
            # 6. Prepare update payload
            update_data = {
                "mls_load": metrics_dict.get("mls_load"),
                "mec": metrics_dict.get("mec"),
                "int_index": metrics_dict.get("int_index"),
                "dur_index": metrics_dict.get("dur_index"),
                "energy_kj": metrics_dict.get("energy_kj"),
                "drift_pahr_percent": metrics_dict.get("drift_pahr_percent"),
                "normalized_power": metrics_dict.get("normalized_power"),
                "tss": metrics_dict.get("tss"),
            }
            
            # Update interval metrics only if it was an interval session
            if meta.work_type == "intervals":
                update_data.update({
                    "interval_hr_last": metrics_dict.get("interval_hr_last"),
                    "interval_power_last": metrics_dict.get("interval_power_last"),
                    "interval_pace_last": metrics_dict.get("interval_pace_last"),
                    "interval_hr_mean": metrics_dict.get("interval_hr_mean"),
                    "interval_power_mean": metrics_dict.get("interval_power_mean"),
                    "interval_pace_mean": metrics_dict.get("interval_pace_mean"),
                    "interval_respect_score": metrics_dict.get("interval_respect_score"),
                    "interval_detection_source": metrics_dict.get("interval_detection_source"),
                })
                
                # Update Pa:HR in JSONB
                seg = act.get("segmented_metrics") or {}
                seg["interval_pahr_mean"] = metrics_dict.get("interval_pahr_mean")
                seg["interval_pahr_last"] = metrics_dict.get("interval_pahr_last")
                update_data["segmented_metrics"] = seg

            print(f"   📊 Metrics: MLS={update_data['mls_load']}, MEC={update_data['mec']}")
            
            db.client.table("activities").update(update_data).eq("id", act_id).execute()
            
            success_count += 1
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            error_count += 1
    
    print(f"\n🏁 Reprocessing complete: {success_count} success, {error_count} errors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reprocess interval metrics from storage (no Nolio API)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed without making changes")
    parser.add_argument("--limit", type=int, default=50, help="Maximum number of activities to process")
    
    args = parser.parse_args()
    main(dry_run=args.dry_run, limit=args.limit)