"""
Backfill moving_time_sec for existing activities.

For each activity with a fit_file_path and moving_time_sec IS NULL:
1. Download the FIT from Supabase Storage
2. Parse the session record -> extract total_timer_time
3. UPDATE moving_time_sec

Usage:
    python scripts/backfill_moving_time.py [--dry-run] [--limit N]
"""
import os
import sys
import tempfile
import argparse

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser


def main():
    parser = argparse.ArgumentParser(description="Backfill moving_time_sec from FIT files")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be updated without writing")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of activities to process (0=all)")
    args = parser.parse_args()

    db = DBConnector()
    storage = StorageManager()

    # Fetch activities with FIT files but no moving_time_sec
    query = db.client.table("activities") \
        .select("id, fit_file_path, duration_sec, sport_type") \
        .not_.is_("fit_file_path", "null") \
        .is_("moving_time_sec", "null")

    if args.limit > 0:
        query = query.limit(args.limit)

    res = query.execute()
    activities = res.data

    print(f"Found {len(activities)} activities to backfill.")

    updated = 0
    errors = 0

    for act in activities:
        act_id = act["id"]
        fit_path = act["fit_file_path"]
        duration_sec = act.get("duration_sec")

        try:
            fit_data = storage.download_fit_file(fit_path)
            if not fit_data:
                print(f"  [{act_id}] File not found: {fit_path}")
                errors += 1
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name

            try:
                _, device_meta, _ = UniversalParser.parse(tmp_path)
                timer_time = device_meta.get("total_timer_time")

                if timer_time and timer_time > 0:
                    moving_time = float(timer_time)
                else:
                    moving_time = float(duration_sec) if duration_sec else None

                if moving_time is None:
                    print(f"  [{act_id}] No timer time and no duration — skipping")
                    continue

                diff = abs(moving_time - (duration_sec or 0))
                marker = " ***" if diff > 60 else ""

                if args.dry_run:
                    print(f"  [{act_id}] Would set moving_time_sec={moving_time:.0f} (elapsed={duration_sec}){marker}")
                else:
                    db.client.table("activities") \
                        .update({"moving_time_sec": moving_time}) \
                        .eq("id", act_id) \
                        .execute()
                    print(f"  [{act_id}] Updated moving_time_sec={moving_time:.0f} (elapsed={duration_sec}){marker}")

                updated += 1

            finally:
                os.remove(tmp_path)

        except Exception as e:
            print(f"  [{act_id}] Error: {e}")
            errors += 1

    action = "Would update" if args.dry_run else "Updated"
    print(f"\nDone. {action} {updated} activities. Errors: {errors}.")


if __name__ == "__main__":
    main()
