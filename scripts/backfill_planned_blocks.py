#!/usr/bin/env python3
"""
Backfill planned_interval_blocks for all athletes.

For each active athlete:
1. Fetch planned workouts from Nolio API for the given date range
2. Upsert them into the planned_workouts table
3. Find interval activities with empty planned_interval_blocks
4. Match to planned_workouts by athlete_id + date + sport
5. Parse structured_workout → build planned_interval_blocks → update activity
6. Link planned_workouts.linked_activity_id

Usage:
  python scripts/backfill_planned_blocks.py                  # all athletes, 60 days
  python scripts/backfill_planned_blocks.py --days 30        # all athletes, 30 days
  python scripts/backfill_planned_blocks.py --athlete Louis   # single athlete
  python scripts/backfill_planned_blocks.py --dry-run         # preview only
"""

import sys, os, argparse, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.connector import DBConnector

SPORT_MAP = {
    "Course à pied": "Run", "Trail": "Run", "Running": "Run",
    "Vélo": "Bike", "Cyclisme": "Bike", "VTT": "Bike", "Cycling": "Bike",
    "Natation": "Swim", "Swimming": "Swim",
    "Ski de fond": "XC Ski", "Autre": "Other",
}


def normalize_sport(nolio_sport: str) -> str:
    return SPORT_MAP.get(nolio_sport, nolio_sport)


def serialize_planned_workout(pw: dict, athlete_uuid: str) -> dict | None:
    nolio_id = pw.get("nolio_id") or pw.get("id")
    if not nolio_id:
        return None
    distance_km = float(pw.get("distance", 0) or 0)
    distance_m = distance_km * 1000 if 0 < distance_km < 500 else distance_km
    return {
        "athlete_id": athlete_uuid,
        "nolio_planned_id": nolio_id,
        "planned_date": pw.get("date_start"),
        "sport": normalize_sport(pw.get("sport", "Other")),
        "name": pw.get("name", "Sans titre"),
        "duration_planned_sec": int(pw.get("duration", 0) or 0) or None,
        "distance_planned_m": distance_m or None,
        "rpe": pw.get("rpe"),
        "structured_workout": pw.get("structured_workout"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def main():
    ap = argparse.ArgumentParser(description="Backfill planned_interval_blocks from Nolio planned workouts")
    ap.add_argument("--athlete", type=str, default=None, help="Filter by athlete name (partial match)")
    ap.add_argument("--days", type=int, default=60, help="Look-back window in days (default: 60)")
    ap.add_argument("--dry-run", action="store_true", help="Preview matches without writing")
    args = ap.parse_args()

    nolio = NolioClient()
    db = DBConnector()
    parser = NolioPlanParser()
    config = AthleteConfig(db)
    calc = MetricsCalculator(config)

    date_from = (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime("%Y-%m-%d")
    date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Fetch athletes ──
    query = db.client.table("athletes").select("id, first_name, last_name, nolio_id").eq("is_active", True).not_.is_("nolio_id", "null")
    if args.athlete:
        query = query.or_(f"first_name.ilike.%{args.athlete}%,last_name.ilike.%{args.athlete}%")
    athletes = (query.execute()).data or []
    print(f"🚀 Backfill planned_interval_blocks — {len(athletes)} athletes, {date_from} → {date_to}" + (" [DRY RUN]" if args.dry_run else ""))

    total_synced = 0
    total_fixed = 0
    total_empty = 0

    for ath in athletes:
        name = f"{ath['first_name']} {ath['last_name']}"
        try:
            nolio_id = int(ath["nolio_id"])
        except (ValueError, TypeError):
            continue
        athlete_uuid = ath["id"]

        # ── Step 1: Fetch & upsert planned workouts from Nolio ──
        planned_list = nolio.get_planned_workouts_range(nolio_id, date_from, date_to)
        synced = 0
        for pw in (planned_list or []):
            record = serialize_planned_workout(pw, athlete_uuid)
            if not record:
                continue
            if not args.dry_run:
                try:
                    db.client.table("planned_workouts").upsert(record, on_conflict="nolio_planned_id").execute()
                    synced += 1
                except Exception:
                    pass
            else:
                synced += 1
        total_synced += synced
        time.sleep(0.5)  # respect Nolio rate limits

        # ── Step 2: Find activities with empty planned_interval_blocks ──
        res = db.client.table("activities").select(
            "id, activity_name, session_date, sport_type, segmented_metrics"
        ).eq("athlete_id", athlete_uuid).eq(
            "work_type", "intervals"
        ).gte("session_date", date_from).lte("session_date", date_to + "T23:59:59").execute()

        activities = res.data or []
        empty_acts = [
            a for a in activities
            if len((a.get("segmented_metrics") or {}).get("planned_interval_blocks") or []) == 0
        ]

        if not empty_acts:
            if synced:
                print(f"   {name}: synced {synced} PW, no empty activities")
            continue

        # ── Step 3: Match & backfill ──
        fixed = 0
        for act in empty_acts:
            act_date = act["session_date"][:10]
            act_sport = act["sport_type"]

            pw_res = db.client.table("planned_workouts").select(
                "id, name, structured_workout"
            ).eq("athlete_id", athlete_uuid).eq(
                "planned_date", act_date
            ).eq("sport", act_sport).not_.is_(
                "structured_workout", "null"
            ).limit(1).execute()

            if not pw_res.data:
                continue

            pw = pw_res.data[0]
            sport_lower = act_sport.lower()
            if sport_lower in ("vtt", "trail"):
                sport_lower = "bike" if sport_lower == "vtt" else "run"

            target_grid = parser.parse(pw["structured_workout"], sport_type=sport_lower, merge_adjacent_work=True)
            if not target_grid:
                continue

            planned_blocks = calc.build_planned_interval_blocks(
                target_grid=target_grid, sport=sport_lower, planned_source="nolio_structured_workout"
            )
            if not planned_blocks:
                continue

            if not args.dry_run:
                sm = act.get("segmented_metrics") or {}
                sm["planned_interval_blocks"] = planned_blocks
                db.client.table("activities").update({"segmented_metrics": sm}).eq("id", act["id"]).execute()
                db.client.table("planned_workouts").update({"linked_activity_id": act["id"]}).eq("id", pw["id"]).execute()

            fixed += 1

        total_fixed += fixed
        total_empty += len(empty_acts)
        status = "DRY" if args.dry_run else "fixed"
        print(f"   {name}: synced {synced} PW, {status} {fixed}/{len(empty_acts)} activities")

    print(f"\n🎉 Done! Synced {total_synced} planned workouts, fixed {total_fixed}/{total_empty} activities" + (" [DRY RUN]" if args.dry_run else ""))


if __name__ == "__main__":
    main()
