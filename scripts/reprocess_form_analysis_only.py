#!/usr/bin/env python3
"""
Targeted reprocessing: updates ONLY the `form_analysis` JSONB column.
Does NOT touch any other metric (intervals, MLS, power, HR, etc.).
Does NOT call Nolio API or Weather API.
"""
import json
import logging
import os
import sys
import tempfile
import time
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.form_analysis import FormAnalysisEngine, SOT_VERSION

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Safety: snapshot a few activities BEFORE to verify nothing else changed
# ---------------------------------------------------------------------------

SNAPSHOT_FIELDS = [
    "id", "load_index", "durability_index", "decoupling_index",
    "interval_power_mean", "interval_power_last", "interval_hr_mean",
    "interval_hr_last", "interval_pace_mean", "interval_pace_last",
    "interval_respect_score", "work_type",
    "segmented_metrics", "avg_power", "avg_hr",
]


def take_snapshot(db, activity_ids):
    """Snapshot key fields for a sample of activities before update."""
    if not activity_ids:
        return {}
    rows = (
        db.client.table("activities")
        .select(", ".join(SNAPSHOT_FIELDS))
        .in_("id", activity_ids)
        .execute()
        .data
    )
    return {r["id"]: r for r in rows}


def verify_snapshot(db, snapshot):
    """Verify that no field OTHER than form_analysis was changed."""
    if not snapshot:
        return True
    ids = list(snapshot.keys())
    rows = (
        db.client.table("activities")
        .select(", ".join(SNAPSHOT_FIELDS))
        .in_("id", ids)
        .execute()
        .data
    )
    ok = True
    for row in rows:
        aid = row["id"]
        before = snapshot.get(aid)
        if not before:
            continue
        for field in SNAPSHOT_FIELDS:
            if field == "id":
                continue
            v_before = before.get(field)
            v_after = row.get(field)
            # Compare as JSON strings to handle dicts/lists
            if json.dumps(v_before, sort_keys=True, default=str) != json.dumps(v_after, sort_keys=True, default=str):
                log.error(f"  SAFETY VIOLATION: {aid} field '{field}' changed! Before={v_before} After={v_after}")
                ok = False
    return ok


def fetch_interval_details(db, activity_id):
    """Fetch interval details from activity_intervals table."""
    rows = (
        db.client.table("activity_intervals")
        .select("start_time, end_time, duration, type, avg_speed, avg_power, avg_hr")
        .eq("activity_id", activity_id)
        .eq("type", "work")
        .order("start_time")
        .execute()
        .data
    )
    details = []
    for r in rows:
        details.append({
            "status": "matched",
            "start_index": float(r["start_time"]),
            "end_index": float(r["end_time"]),
            "duration_sec": float(r["duration"]),
            "avg_speed": r.get("avg_speed"),
            "avg_power": r.get("avg_power"),
            "avg_hr": r.get("avg_hr"),
            "source": "existing",
        })
    return details


def main():
    db = DBConnector()
    storage = StorageManager()
    form_analyzer = FormAnalysisEngine(db)

    log.info(f"Target SOT_VERSION: {SOT_VERSION}")

    # Fetch ALL activities that need reprocessing (version != current)
    # Paginate with Supabase (max 1000 per request)
    all_activities = []
    page_size = 1000
    offset = 0
    while True:
        rows = (
            db.client.table("activities")
            .select("id, athlete_id, fit_file_path, sport_type, session_date, rpe, "
                    "activity_name, source_sport, work_type, temp_avg, humidity_avg, "
                    "weather_source, source_json, duration_sec, distance_m, "
                    "elevation_gain, manual_work_type, form_analysis")
            .not_.is_("fit_file_path", "null")
            .order("session_date")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
        )
        if not rows:
            break
        all_activities.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    # Filter: only activities where form_analysis version != SOT_VERSION
    to_process = []
    already_current = 0
    no_form = 0
    for act in all_activities:
        fa = act.get("form_analysis")
        if isinstance(fa, dict) and fa.get("version") == SOT_VERSION:
            already_current += 1
            continue
        to_process.append(act)
        if fa is None:
            no_form += 1

    log.info(f"Total activities: {len(all_activities)}")
    log.info(f"Already current version: {already_current}")
    log.info(f"To reprocess: {len(to_process)} (including {no_form} with no form_analysis)")

    if not to_process:
        log.info("Nothing to reprocess. Exiting.")
        return

    # Safety snapshot: pick first 5 activities to verify after
    snapshot_ids = [a["id"] for a in to_process[:5]]
    snapshot_before = take_snapshot(db, snapshot_ids)
    log.info(f"Safety snapshot taken for {len(snapshot_ids)} activities")

    # Process
    success = 0
    errors = 0
    skipped = 0
    start_time = time.time()

    for i, act in enumerate(to_process):
        activity_id = act["id"]
        fit_path = act.get("fit_file_path")

        if i > 0 and i % 50 == 0:
            elapsed = time.time() - start_time
            rate = success / elapsed if elapsed > 0 else 0
            log.info(f"Progress: {i}/{len(to_process)} | OK={success} ERR={errors} SKIP={skipped} | {rate:.1f}/s")

        if not fit_path:
            skipped += 1
            continue

        try:
            # Download FIT
            fit_data = storage.download_fit_file(fit_path)
            if not fit_data:
                skipped += 1
                continue

            # Parse FIT
            with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name

            try:
                df, device_meta, laps = UniversalParser.parse(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

            if df.empty:
                skipped += 1
                continue

            # Build ActivityMetadata from existing DB record (no API calls)
            session_date = act["session_date"]
            if isinstance(session_date, str):
                session_date = datetime.fromisoformat(session_date.replace("Z", "+00:00"))

            # Moving time from FIT
            fit_timer_time = device_meta.get("total_timer_time")
            moving_time = float(fit_timer_time) if fit_timer_time and fit_timer_time > 0 else float(len(df))

            meta = ActivityMetadata(
                activity_type=act.get("sport_type") or "unknown",
                activity_name=act.get("activity_name"),
                source_sport=act.get("source_sport"),
                start_time=session_date,
                duration_sec=act.get("duration_sec") or float(len(df)),
                moving_time_sec=moving_time,
                distance_m=act.get("distance_m"),
                elevation_gain=act.get("elevation_gain"),
                rpe=act.get("rpe"),
                work_type=act.get("work_type"),
                manual_work_type=act.get("manual_work_type"),
                temp_avg=act.get("temp_avg"),
                humidity_avg=act.get("humidity_avg"),
                weather_source=act.get("weather_source"),
                source_json=act.get("source_json"),
            )

            activity = Activity(metadata=meta, streams=df, laps=laps)

            # Get interval details for interval activities
            interval_details = None
            if (act.get("work_type") or "").lower() == "intervals":
                interval_details = fetch_interval_details(db, activity_id)

            # Build minimal metrics_dict (form_analysis doesn't use these for computation,
            # but the signature requires it)
            metrics_dict = {}

            # Compute form_analysis
            new_fa = form_analyzer.analyze(
                activity_id=activity_id,
                athlete_id=act["athlete_id"],
                activity=activity,
                metrics_dict=metrics_dict,
                interval_details=interval_details,
            )

            # Update ONLY form_analysis column
            db.client.table("activities").update(
                {"form_analysis": new_fa}
            ).eq("id", activity_id).execute()

            success += 1

        except Exception as e:
            errors += 1
            if errors <= 10:
                log.error(f"  Error on {activity_id}: {e}")

    elapsed = time.time() - start_time
    log.info(f"\nDone in {elapsed:.0f}s | OK={success} ERR={errors} SKIP={skipped}")

    # Safety verification
    log.info("Running safety verification on snapshot...")
    if verify_snapshot(db, snapshot_before):
        log.info("SAFETY CHECK PASSED: no other fields were modified")
    else:
        log.error("SAFETY CHECK FAILED: some fields were modified unexpectedly!")


if __name__ == "__main__":
    main()
