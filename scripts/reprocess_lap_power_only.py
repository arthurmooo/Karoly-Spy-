"""
Laser-focused backfill for lap power fields on bike activities.

This script updates only the following keys inside existing `garmin_laps` items:
- avg_power
- avg_power_with_zeros

All other lap keys are preserved from the current DB payload.

Usage:
    python scripts/reprocess_lap_power_only.py --date-from 2026-03-01 --apply
"""

import argparse
import os
import sys
import tempfile
from copy import deepcopy
from datetime import date
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.stream_sampler import serialize_laps


POWER_KEYS = ("avg_power", "avg_power_with_zeros")


def is_bike_sport(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() in {"bike", "cycling", "vtt", "velo", "vélo"}


def merge_power_fields_only(current_laps: list[dict[str, Any]], computed_laps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    computed_by_lap = {
        int(lap["lap_n"]): lap
        for lap in computed_laps
        if isinstance(lap, dict) and lap.get("lap_n") is not None
    }

    merged: list[dict[str, Any]] = []
    for current in current_laps:
        if not isinstance(current, dict):
            merged.append(current)
            continue

        lap_n = current.get("lap_n")
        next_lap = deepcopy(current)
        computed = computed_by_lap.get(int(lap_n)) if lap_n is not None else None

        if computed is not None:
            for key in POWER_KEYS:
                if computed.get(key) is None:
                    next_lap.pop(key, None)
                else:
                    next_lap[key] = computed[key]

        merged.append(next_lap)

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill only lap power fields in garmin_laps")
    parser.add_argument("--date-from", required=True, help="Start date inclusive (YYYY-MM-DD)")
    parser.add_argument("--date-to", help="End date inclusive (YYYY-MM-DD). Defaults to today")
    parser.add_argument("--apply", action="store_true", help="Write to DB. Default is dry-run.")
    parser.add_argument("--limit", type=int, default=0, help="Max activities to process (0 = all)")
    args = parser.parse_args()

    date_to = args.date_to or date.today().isoformat()

    db = DBConnector()
    storage = StorageManager()

    rows = (
        db.client.table("activities")
        .select("id, session_date, activity_name, sport_type, fit_file_path, garmin_laps")
        .gte("session_date", f"{args.date_from}T00:00:00")
        .lte("session_date", f"{date_to}T23:59:59")
        .not_.is_("fit_file_path", "null")
        .order("session_date")
        .execute()
        .data
        or []
    )

    targets = [
        row
        for row in rows
        if is_bike_sport(row.get("sport_type")) and isinstance(row.get("garmin_laps"), list) and row["garmin_laps"]
    ]

    if args.limit > 0:
        targets = targets[: args.limit]

    print(f"targets={len(targets)}")

    updated = 0
    skipped = 0
    for row in targets:
        fit_path = row.get("fit_file_path")
        current_laps = row.get("garmin_laps") or []
        if not fit_path:
            skipped += 1
            continue

        fit_data = storage.download_fit_file(fit_path)
        if not fit_data:
            print(f"SKIP missing fit {row['id']} {row.get('activity_name')}")
            skipped += 1
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name

        try:
            df, meta, raw_laps = UniversalParser.parse(tmp_path)
            computed_laps = serialize_laps(
                raw_laps,
                meta.get("start_time"),
                sport=row.get("sport_type"),
                stream_df=df,
            ) if raw_laps else []

            merged_laps = merge_power_fields_only(current_laps, computed_laps)

            changed = merged_laps != current_laps
            filled = sum(
                1 for lap in merged_laps
                if isinstance(lap, dict) and lap.get("avg_power_with_zeros") is not None
            )
            total = len(merged_laps)

            print(
                f"{'WRITE' if args.apply else 'DRY '} {row['session_date']} {row.get('activity_name')} "
                f"id={row['id']} changed={changed} p0={filled}/{total}"
            )

            if changed and args.apply:
                db.client.table("activities").update({"garmin_laps": merged_laps}).eq("id", row["id"]).execute()
            if changed:
                updated += 1
        finally:
            os.unlink(tmp_path)

    print(f"updated={updated} skipped={skipped}")
    if not args.apply:
        print("(dry-run)")


if __name__ == "__main__":
    main()
