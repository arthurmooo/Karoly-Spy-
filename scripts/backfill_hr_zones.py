"""
Backfill hr_zones_sec for all activities that have HR data but no zones computed.

Downloads FIT files from Supabase Storage, parses the HR stream, looks up the
athlete's physio profile (LT1/LT2), and computes the 6 sub-zone distribution.

Usage:
    python scripts/backfill_hr_zones.py                    # all athletes
    python scripts/backfill_hr_zones.py --athlete "Louis"  # single athlete
    python scripts/backfill_hr_zones.py --dry-run           # count only
    python scripts/backfill_hr_zones.py --limit 10          # test on 10
"""
import argparse
import json
import os
import sys
import tempfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.config_manager import AthleteConfig


def compute_hr_zones(hr_series, lt1_hr: float, lt2_hr: float) -> dict:
    """Standalone copy of MetricsCalculator._compute_hr_zones (avoids private access)."""
    hr = hr_series.dropna()
    if len(hr) == 0:
        return {}
    z1_mid = lt1_hr / 2.0
    z2_mid = lt1_hr + (lt2_hr - lt1_hr) / 2.0
    z3_mid = lt2_hr + (lt2_hr - lt1_hr) / 2.0
    return {
        "Z1i":  int((hr < z1_mid).sum()),
        "Z1ii": int(((hr >= z1_mid) & (hr < lt1_hr)).sum()),
        "Z2i":  int(((hr >= lt1_hr) & (hr < z2_mid)).sum()),
        "Z2ii": int(((hr >= z2_mid) & (hr < lt2_hr)).sum()),
        "Z3i":  int(((hr >= lt2_hr) & (hr < z3_mid)).sum()),
        "Z3ii": int((hr >= z3_mid).sum()),
    }


def main():
    parser = argparse.ArgumentParser(description="Backfill hr_zones_sec for activities missing it.")
    parser.add_argument("--athlete", type=str, default=None, help="Filter by athlete first_name (ilike)")
    parser.add_argument("--dry-run", action="store_true", help="Count activities without modifying DB")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of activities to process")
    args = parser.parse_args()

    db = DBConnector()
    storage = StorageManager()
    profile_mgr = ProfileManager(db)

    # Build query: activities with HR data but no zones, that have a FIT file
    query = db.client.table("activities") \
        .select("id, athlete_id, sport_type, session_date, fit_file_path") \
        .not_.is_("avg_hr", "null") \
        .is_("hr_zones_sec", "null") \
        .not_.is_("fit_file_path", "null")

    # Filter by athlete if requested
    if args.athlete:
        athlete_rows = db.client.table("athletes") \
            .select("id, first_name, last_name") \
            .ilike("first_name", f"%{args.athlete}%") \
            .execute().data
        if not athlete_rows:
            print(f"No athlete found matching '{args.athlete}'")
            return
        athlete_ids = [a["id"] for a in athlete_rows]
        names = [f"{a['first_name']} {a['last_name']}" for a in athlete_rows]
        print(f"Filtering for: {', '.join(names)}")
        if len(athlete_ids) == 1:
            query = query.eq("athlete_id", athlete_ids[0])
        else:
            query = query.in_("athlete_id", athlete_ids)

    query = query.order("session_date")

    # Paginate through all results (Supabase default limit is 1000)
    all_activities = []
    page_size = 1000
    offset = 0
    while True:
        page = query.range(offset, offset + page_size - 1).execute().data
        if not page:
            break
        all_activities.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    total = len(all_activities)
    if args.limit:
        all_activities = all_activities[:args.limit]

    print(f"Found {total} activities to backfill" + (f" (limited to {args.limit})" if args.limit else ""))

    if args.dry_run:
        print("Dry run — no changes made.")
        return

    updated = 0
    skipped_no_file = 0
    skipped_no_hr_stream = 0
    skipped_no_profile = 0
    skipped_empty_zones = 0
    errors = 0

    for i, act in enumerate(all_activities):
        act_id = act["id"]
        path = act["fit_file_path"]
        sport = act["sport_type"]
        session_date = datetime.fromisoformat(act["session_date"])

        try:
            # Download FIT
            fit_data = storage.download_fit_file(path)
            if not fit_data:
                skipped_no_file += 1
                continue

            # Parse
            with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name

            try:
                df, _, _ = UniversalParser.parse(tmp_path)
            finally:
                os.remove(tmp_path)

            if df.empty or "heart_rate" not in df.columns:
                skipped_no_hr_stream += 1
                continue

            # Get physio profile
            profile = profile_mgr.get_profile_for_date(act["athlete_id"], sport, session_date)
            if not profile or profile.lt1_hr is None or profile.lt2_hr is None:
                skipped_no_profile += 1
                continue

            # Compute zones
            zones = compute_hr_zones(df["heart_rate"], profile.lt1_hr, profile.lt2_hr)
            if not zones:
                skipped_empty_zones += 1
                continue

            # Update DB
            db.client.table("activities") \
                .update({"hr_zones_sec": zones}) \
                .eq("id", act_id) \
                .execute()

            updated += 1
            if (i + 1) % 100 == 0:
                print(f"  [{i+1}/{len(all_activities)}] {updated} updated...")

        except Exception as e:
            errors += 1
            print(f"  ❌ Error on {act_id}: {e}")

    print(f"\nDone.")
    print(f"  Updated:              {updated}")
    print(f"  Skipped (no file):    {skipped_no_file}")
    print(f"  Skipped (no HR):      {skipped_no_hr_stream}")
    print(f"  Skipped (no profile): {skipped_no_profile}")
    print(f"  Skipped (empty):      {skipped_empty_zones}")
    print(f"  Errors:               {errors}")


if __name__ == "__main__":
    main()
