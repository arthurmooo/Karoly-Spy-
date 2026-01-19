import sys
import os
import tempfile
import argparse
import hashlib
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.db.writer import ActivityWriter
from projectk_core.processing.plan_parser import NolioPlanParser

def run_test(athlete_nolio_id, date_str):
    db = DBConnector()
    client = NolioClient()
    print(f"🚀 Athlete {athlete_nolio_id} - {date_str}")
    activities = client.get_activities(athlete_nolio_id, date_str, date_str)
    if not activities:
        print("❌ No activity found")
        return
    
    nolio_activity = activities[0]
    act_id = nolio_activity.get('nolio_id') or nolio_activity.get('id')
    if not act_id:
        print(f"❌ No ID in {nolio_activity.keys()}")
        return

    athlete_data = db.client.table("athletes").select("id").eq("nolio_id", str(athlete_nolio_id)).execute()
    athlete_uuid = athlete_data.data[0]['id']

    print(f"✅ Activity: {nolio_activity.get('name')} ({act_id})")
    fit_data = client.get_activity_fit(act_id)
    if not fit_data:
        print("⚠️ No FIT file")
        return

    file_hash = hashlib.sha256(fit_data).hexdigest()
    fd, tmp_path = tempfile.mkstemp(suffix=".fit")
    try:
        with os.fdopen(fd, 'wb') as tmp:
            tmp.write(fit_data)
        df, meta, laps = FitParser.parse(tmp_path)
        activity_meta = ActivityMetadata(
            athlete_id=athlete_uuid,
            start_time=meta['start_time'],
            duration=meta['duration'],
            distance=meta['distance'],
            sport=meta['sport'],
            device_serial=meta['device_serial'],
            fit_file_hash=file_hash,
            title=nolio_activity.get('name')
        )
        activity = Activity(df, activity_meta)
        plan = client.find_planned_workout(athlete_uuid, date_str, nolio_activity.get('name'))
        target_grid = []
        if plan:
            print(f"📋 Plan found: {plan.get('name')}")
            parser = NolioPlanParser()
            target_grid = parser.flatten_workout(plan.get('structured_workout', []))
        
        metrics = MetricsCalculator.calculate(activity, target_grid=target_grid)
        writer = ActivityWriter(db)
        writer.save(activity, metrics)
        print(f"✅ DONE. Respect: {metrics.interval_respect_score}%")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        traceback.print_exc()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--athlete_id", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()
    run_test(args.athlete_id, args.date)