"""
Backfill activity_streams and garmin_laps for existing activities.
Downloads FIT files from Supabase Storage (raw_fits bucket), parses them,
and stores downsampled streams + laps in JSONB columns.

Usage:
    python scripts/backfill_streams_laps.py              # dry-run (read-only)
    python scripts/backfill_streams_laps.py --apply      # write to DB
    python scripts/backfill_streams_laps.py --limit 10   # process max N activities
    python scripts/backfill_streams_laps.py --date 2026-03-10 --apply  # specific date
"""
import sys
import os
import argparse
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.stream_sampler import downsample_streams, serialize_laps


def main():
    parser = argparse.ArgumentParser(description="Backfill activity_streams & garmin_laps")
    parser.add_argument("--apply", action="store_true", help="Actually write to DB (default: dry-run)")
    parser.add_argument("--limit", type=int, default=0, help="Max activities to process (0 = all)")
    parser.add_argument("--date", type=str, default=None, help="Filter by date (YYYY-MM-DD)")
    args = parser.parse_args()

    db = DBConnector()
    storage = StorageManager()

    # Fetch activities with a FIT file but no streams yet (paginated, Supabase max 1000/query)
    activities = []
    page_size = 1000
    offset = 0

    while True:
        query = (
            db.client.table("activities")
            .select("id, fit_file_path, session_date, activity_name, sport_type")
            .is_("activity_streams", "null")
            .not_.is_("fit_file_path", "null")
            .order("session_date", desc=True)
            .range(offset, offset + page_size - 1)
        )

        if args.date:
            query = query.gte("session_date", f"{args.date}T00:00:00").lte("session_date", f"{args.date}T23:59:59")

        result = query.execute()
        batch = result.data or []
        activities.extend(batch)

        if len(batch) < page_size:
            break
        offset += page_size

    if args.limit > 0:
        activities = activities[:args.limit]

    print(f"Found {len(activities)} activities to backfill")
    if not activities:
        return

    success = 0
    errors = 0

    for act in activities:
        act_id = act["id"]
        fit_path = act["fit_file_path"]
        name = act.get("activity_name", "?")
        sport = act.get("sport_type", "?")

        if not fit_path:
            print(f"  SKIP {act_id} ({name}) — no fit_file_path")
            errors += 1
            continue

        try:
            # Download FIT from Supabase Storage
            fit_data = storage.download_fit_file(fit_path)
            if not fit_data:
                print(f"  SKIP {act_id} ({name}) — file not found in storage: {fit_path}")
                errors += 1
                continue

            # Write to temp file for parsing
            with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name

            try:
                df, meta, laps = UniversalParser.parse(tmp_path)

                streams_json = downsample_streams(df, interval_sec=5, sport=sport) if not df.empty and "heart_rate" in df.columns else None
                laps_json = serialize_laps(laps, meta.get("start_time"), sport=sport) if laps else None

                n_pts = len(streams_json) if streams_json else 0
                n_laps = len(laps_json) if laps_json else 0
                print(f"  {'WRITE' if args.apply else 'DRY'} {act_id} [{sport}] ({name}) — {n_pts} pts, {n_laps} laps")

                if args.apply:
                    db.client.table("activities").update({
                        "activity_streams": streams_json,
                        "garmin_laps": laps_json,
                    }).eq("id", act_id).execute()

                success += 1
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            print(f"  ERROR {act_id} ({name}) — {e}")
            errors += 1

    print(f"\nDone: {success} OK, {errors} errors")
    if not args.apply:
        print("(dry-run — use --apply to write)")


if __name__ == "__main__":
    main()
