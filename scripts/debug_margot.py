
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import UniversalParser
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.profile_manager import ProfileManager
from datetime import datetime, timezone

def debug_reprocess():
    db = DBConnector()
    nolio = NolioClient()
    print("🔍 Fetching Margot Sellem's activity from DB...")
    
    res = db.client.table("activities") \
        .select("nolio_id, athlete_id, activity_name, sport_type, session_date") \
        .ilike("activity_name", "%31Km : 9Km%") \
        .execute()
    
    if not res.data:
        print("❌ Activity not found.")
        return
    
    row = res.data[0]
    nolio_id = row['nolio_id']
    athlete_uuid = row['athlete_id']
    
    print(f"📍 Nolio ID: {nolio_id}")
    
    # Fetch details from Nolio
    print(f"📥 Fetching details from Nolio for activity {nolio_id}...")
    # We need the athlete's Nolio ID too.
    ath_res = db.client.table("athletes").select("nolio_id").eq("id", athlete_uuid).execute()
    athlete_nolio_id = ath_res.data[0]['nolio_id']
    
    nolio_act = nolio.get_activity_details(nolio_id, athlete_id=athlete_nolio_id)
    if not nolio_act:
        print("❌ Could not fetch activity from Nolio.")
        return
    
    file_url = nolio_act.get("file_url")
    if not file_url:
        print("❌ No FIT file URL found for this activity.")
        return
        
    print(f"📂 Downloading FIT file from {file_url}...")
    fit_data = nolio.download_fit_file(file_url)
    
    if not fit_data:
        print("❌ Failed to download FIT file.")
        return
        
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    print("🔄 Parsing FIT file...")
    df, meta_dev, laps = UniversalParser.parse(tmp_path)
    print(f"   Laps found: {len(laps)}")
    for i, lap in enumerate(laps):
        print(f"   Lap {i+1}: Duration {lap.get('total_elapsed_time')}s, Dist {lap.get('total_distance')}m, Intensity {lap.get('avg_speed')}m/s")
    
    # Setup MetricsCalculator
    config = AthleteConfig()
    calc = MetricsCalculator(config)
    profile_mgr = ProfileManager(db)
    
    start_date = datetime.fromisoformat(row['session_date'].replace('Z', '+00:00'))
    profile = profile_mgr.get_profile_for_date(athlete_uuid, row['sport_type'], start_date)
    
    meta = ActivityMetadata(
        activity_type=row['sport_type'],
        activity_name=row['activity_name'],
        start_time=start_date,
        duration_sec=df['time'].max() if 'time' in df.columns else 0,
        distance_m=df['distance'].max() if 'distance' in df.columns else 0
    )
    
    activity = Activity(metadata=meta, streams=df, laps=laps)
    
    print("📊 Computing metrics...")
    metrics = calc.compute(activity, profile)
    
    print("\n✅ Resulting Interval Metrics:")
    print(f"   interval_power_last: {metrics.get('interval_power_last')}")
    print(f"   interval_hr_last: {metrics.get('interval_hr_last')}")
    print(f"   interval_power_mean: {metrics.get('interval_power_mean')}")
    print(f"   interval_hr_mean: {metrics.get('interval_hr_mean')}")
    print(f"   interval_pace_last: {metrics.get('interval_pace_last')}")
    print(f"   interval_pace_mean: {metrics.get('interval_pace_mean')}")
    
    os.remove(tmp_path)

if __name__ == "__main__":
    debug_reprocess()
