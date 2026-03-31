#!/usr/bin/env python3
"""
Backfill planned_interval_blocks for Louis Richard.

Steps:
1. Fetch planned workouts from Nolio for March 2026
2. Upsert them into planned_workouts table
3. Match them to existing activities (by athlete + date + sport)
4. Parse structured_workout → target_grid → planned_interval_blocks
5. Update activities.segmented_metrics with the planned data
6. Link planned_workouts to activities (linked_activity_id)
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.db.connector import DBConnector

ATHLETE_UUID = "1cc0cd46-e5a0-4a94-8b49-2df03be964fb"
ATHLETE_NOLIO_ID = 3245
DATE_FROM = "2026-03-01"
DATE_TO = "2026-03-31"

SPORT_MAP = {
    "Course à pied": "Run", "Trail": "Run", "Running": "Run",
    "Vélo": "Bike", "Cyclisme": "Bike", "VTT": "Bike", "Cycling": "Bike",
    "Natation": "Swim", "Swimming": "Swim",
    "Ski de fond": "XC Ski", "Autre": "Other",
}

def normalize_sport(nolio_sport: str) -> str:
    return SPORT_MAP.get(nolio_sport, nolio_sport)


def main():
    nolio = NolioClient()
    db = DBConnector()
    parser = NolioPlanParser()
    config = AthleteConfig(db)
    calc = MetricsCalculator(config)

    # ── Step 1: Fetch planned workouts from Nolio ──
    print(f"📅 Fetching planned workouts for Louis Richard ({DATE_FROM} → {DATE_TO})...")
    planned_list = nolio.get_planned_workouts_range(ATHLETE_NOLIO_ID, DATE_FROM, DATE_TO)
    print(f"   → Got {len(planned_list)} planned workouts from Nolio")

    if not planned_list:
        print("   ❌ No planned workouts found. Check API quota or token.")
        return

    # ── Step 2: Upsert into planned_workouts table ──
    print("💾 Upserting into planned_workouts...")
    upserted = 0
    for pw in planned_list:
        nolio_id = pw.get("nolio_id") or pw.get("id")
        if not nolio_id:
            continue
        nolio_sport = pw.get("sport", "Other")
        internal_sport = normalize_sport(nolio_sport)
        distance_km = float(pw.get("distance", 0) or 0)
        distance_m = distance_km * 1000 if 0 < distance_km < 500 else distance_km

        record = {
            "athlete_id": ATHLETE_UUID,
            "nolio_planned_id": nolio_id,
            "planned_date": pw.get("date_start"),
            "sport": internal_sport,
            "name": pw.get("name", "Sans titre"),
            "duration_planned_sec": int(pw.get("duration", 0) or 0) or None,
            "distance_planned_m": distance_m or None,
            "rpe": pw.get("rpe"),
            "structured_workout": pw.get("structured_workout"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            db.client.table("planned_workouts").upsert(
                record, on_conflict="nolio_planned_id"
            ).execute()
            upserted += 1
        except Exception as e:
            print(f"   ⚠️ Failed to upsert pw {nolio_id}: {e}")

    print(f"   ✅ Upserted {upserted} planned workouts")

    # ── Step 3: Find Louis Richard's interval activities with empty planned blocks ──
    print("🔍 Finding activities with empty planned_interval_blocks...")
    res = db.client.table("activities").select(
        "id, activity_name, session_date, sport_type, segmented_metrics"
    ).eq("athlete_id", ATHLETE_UUID).eq(
        "work_type", "intervals"
    ).gte("session_date", DATE_FROM).lte("session_date", DATE_TO + "T23:59:59").execute()

    activities = res.data or []
    empty_acts = []
    for act in activities:
        sm = act.get("segmented_metrics") or {}
        pib = sm.get("planned_interval_blocks") or []
        if len(pib) == 0:
            empty_acts.append(act)

    print(f"   → {len(empty_acts)} activities with empty planned_interval_blocks (out of {len(activities)} interval activities)")

    if not empty_acts:
        print("   ✅ Nothing to backfill!")
        return

    # ── Step 4: Match & backfill ──
    print("🔧 Matching and backfilling...")
    fixed = 0
    for act in empty_acts:
        act_date = act["session_date"][:10]  # YYYY-MM-DD
        act_sport = act["sport_type"]

        # Find matching planned_workout
        pw_res = db.client.table("planned_workouts").select(
            "id, name, structured_workout"
        ).eq("athlete_id", ATHLETE_UUID).eq(
            "planned_date", act_date
        ).eq("sport", act_sport).not_.is_(
            "structured_workout", "null"
        ).limit(1).execute()

        if not pw_res.data:
            # Try broader sport match (Run ↔ Trail, etc.)
            print(f"   ⏭️  No matching PW for '{act['activity_name']}' ({act_date}, {act_sport})")
            continue

        pw = pw_res.data[0]
        struct = pw["structured_workout"]
        sport_lower = act_sport.lower()
        if sport_lower in ("vtt", "trail"):
            sport_lower = "bike" if sport_lower == "vtt" else "run"

        # Parse structured_workout → target_grid
        target_grid = parser.parse(struct, sport_type=sport_lower, merge_adjacent_work=True)
        if not target_grid:
            print(f"   ⚠️  Parser returned empty grid for '{act['activity_name']}' (pw: {pw['name']})")
            continue

        # Build planned_interval_blocks
        planned_blocks = calc.build_planned_interval_blocks(
            target_grid=target_grid,
            sport=sport_lower,
            planned_source="nolio_structured_workout"
        )
        if not planned_blocks:
            print(f"   ⚠️  No planned blocks generated for '{act['activity_name']}'")
            continue

        # Update activity segmented_metrics
        sm = act.get("segmented_metrics") or {}
        sm["planned_interval_blocks"] = planned_blocks

        db.client.table("activities").update({
            "segmented_metrics": sm
        }).eq("id", act["id"]).execute()

        # Link planned_workout to activity
        db.client.table("planned_workouts").update({
            "linked_activity_id": act["id"]
        }).eq("id", pw["id"]).execute()

        fixed += 1
        print(f"   ✅ Fixed '{act['activity_name']}' ({act_date}) → {len(planned_blocks)} planned blocks (from PW '{pw['name']}')")

    print(f"\n🎉 Done! Fixed {fixed}/{len(empty_acts)} activities for Louis Richard")


if __name__ == "__main__":
    main()
