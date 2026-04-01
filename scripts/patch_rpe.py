"""
Patch missing RPE values from Nolio API.

Athletes often fill in their RPE after the 2-hour ingestion window. This script:
1. Finds activities with rpe=NULL or rpe=0 in the database
2. Re-fetches RPE from Nolio (1 API call per athlete, batch by date range)
3. Surgically updates rpe + recalculates PER, sRPE, MLS (no FIT re-download)

Usage:
    python scripts/patch_rpe.py                        # all history, all athletes
    python scripts/patch_rpe.py --since-days 14        # last 14 days only
    python scripts/patch_rpe.py --athlete "Karoly"     # single athlete
    python scripts/patch_rpe.py --dry-run              # preview without writing
"""
import argparse
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient

# PER formula constants (mirror calculator.py:271-272)
K_RPE = 0.3
PER_MIN = 0.85
PER_MAX = 1.15


class RPEPatcher:
    def __init__(self, db: DBConnector, nolio: NolioClient):
        self.db = db
        self.nolio = nolio

    def find_missing(self, since_days: Optional[int] = None) -> List[Dict]:
        """Find activities with missing or zero RPE."""
        query = self.db.client.table("activities").select(
            "id, nolio_id, athlete_id, session_date, rpe, "
            "moving_time_sec, duration_sec, load_index, "
            "load_components, segmented_metrics"
        ).or_("rpe.is.null,rpe.eq.0").not_.is_("nolio_id", "null")

        if since_days is not None:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
            query = query.gte("session_date", cutoff)

        res = query.order("session_date", desc=True).execute()
        return res.data or []

    def fetch_nolio_rpe(self, athlete_nolio_id: int, date_from: str, date_to: str) -> Dict[str, int]:
        """Fetch RPE values from Nolio for a date range. Returns {nolio_id_str: rpe}."""
        try:
            activities = self.nolio.get_activities(athlete_nolio_id, date_from, date_to)
        except Exception as e:
            print(f"      ⚠️ Nolio API error: {e}")
            return {}

        rpe_map = {}
        for act in activities:
            act_id = str(act.get("nolio_id", act.get("id", "")))
            rpe = act.get("rpe")
            if act_id and rpe is not None and rpe >= 1:
                rpe_map[act_id] = int(rpe)
        return rpe_map

    def patch_activity(self, record: Dict, new_rpe: int) -> Dict:
        """Surgically update RPE and recalculate PER, sRPE, MLS for one activity."""
        activity_id = record["id"]
        old_rpe = record.get("rpe")
        old_load_index = record.get("load_index")

        # --- Recalculate PER ---
        load_components = record.get("load_components") or {}
        segmented_metrics = record.get("segmented_metrics") or {}
        external = load_components.get("external") or {}
        intensity_ratio_avg = external.get("intensity_ratio_avg")

        per_index = 1.0
        rpe_delta = None
        if intensity_ratio_avg is not None:
            rpe_norm = (new_rpe - 1) / 9.0
            rpe_delta = round(rpe_norm - intensity_ratio_avg, 4)
            per_index = max(PER_MIN, min(PER_MAX, 1.0 + K_RPE * rpe_delta))
            per_index = round(per_index, 4)

        # --- Recalculate MLS ---
        new_load_index = old_load_index
        if old_load_index is not None:
            # Old PER was 1.0 (RPE was missing), so old_load_index = base * 1.0
            new_load_index = round(old_load_index * per_index, 1)

        # --- Recalculate sRPE ---
        moving = record.get("moving_time_sec") or record.get("duration_sec")
        duration_min = (moving / 60.0) if moving else None
        srpe_load = round(duration_min * new_rpe, 2) if duration_min else None

        # --- Build surgical update ---
        # Merge into existing JSONB (preserve all other keys)
        updated_segmented = {**segmented_metrics, "per_index": per_index, "rpe_delta": rpe_delta}

        internal = load_components.get("internal") or {}
        global_lc = load_components.get("global") or {}
        updated_load_components = {
            **load_components,
            "internal": {**internal, "srpe_load": srpe_load},
            "global": {**global_lc, "mls": round(float(new_load_index), 1) if new_load_index is not None else None},
        }

        update_payload = {
            "rpe": new_rpe,
            "missing_rpe_flag": False,
            "load_index": new_load_index,
            "segmented_metrics": updated_segmented,
            "load_components": updated_load_components,
        }

        self.db.client.table("activities").update(update_payload).eq("id", activity_id).execute()

        return {
            "activity_id": activity_id,
            "old_rpe": old_rpe,
            "new_rpe": new_rpe,
            "per_index": per_index,
            "old_mls": old_load_index,
            "new_mls": new_load_index,
            "srpe": srpe_load,
        }

    def run(self, since_days: Optional[int] = None, dry_run: bool = False, athlete_filter: Optional[str] = None) -> Dict:
        """Main entry point. Returns summary stats."""
        print(f"🩹 RPE Patcher — since_days={since_days}, dry_run={dry_run}, athlete={athlete_filter or 'all'}")

        # 1. Find missing RPE activities
        missing = self.find_missing(since_days=since_days)
        if not missing:
            print("   ✅ No activities with missing RPE.")
            return {"patched": 0, "still_missing": 0, "total_checked": 0}

        # 2. Load athletes roster
        ath_query = self.db.client.table("athletes").select("id, first_name, last_name, nolio_id").eq("is_active", True).not_.is_("nolio_id", "null")
        if athlete_filter:
            ath_query = ath_query.or_(f"first_name.ilike.%{athlete_filter}%,last_name.ilike.%{athlete_filter}%")
        athletes = {a["id"]: a for a in (ath_query.execute().data or [])}

        # 3. Group missing activities by athlete
        by_athlete = defaultdict(list)
        for act in missing:
            aid = act["athlete_id"]
            if aid in athletes:
                by_athlete[aid].append(act)

        print(f"   📋 Found {len(missing)} activities with missing RPE across {len(by_athlete)} athletes.")

        patched = 0
        still_missing = 0

        for athlete_id, acts in by_athlete.items():
            ath = athletes[athlete_id]
            name = f"{ath['first_name']} {ath['last_name']}"
            nolio_id = ath["nolio_id"]

            # Compute date range for this athlete's missing activities
            dates = [a["session_date"][:10] for a in acts if a.get("session_date")]
            if not dates:
                continue
            date_from = (datetime.strptime(min(dates), "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
            date_to = (datetime.strptime(max(dates), "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")

            print(f"\n   👤 {name} — {len(acts)} missing, fetching Nolio [{date_from} → {date_to}]")

            # Single API call per athlete
            rpe_map = self.fetch_nolio_rpe(nolio_id, date_from, date_to)

            for act in acts:
                act_nolio_id = str(act.get("nolio_id", ""))
                new_rpe = rpe_map.get(act_nolio_id)

                if new_rpe is None:
                    still_missing += 1
                    continue

                if dry_run:
                    print(f"      🔍 [DRY] {act_nolio_id} ({act['session_date'][:10]}): RPE → {new_rpe}")
                    patched += 1
                else:
                    result = self.patch_activity(act, new_rpe)
                    print(f"      ✅ {act_nolio_id} ({act['session_date'][:10]}): "
                          f"RPE {result['old_rpe']}→{result['new_rpe']} | "
                          f"PER={result['per_index']} | "
                          f"MLS {result['old_mls']}→{result['new_mls']} | "
                          f"sRPE={result['srpe']}")
                    patched += 1

            # Anti rate-limit between athletes
            time.sleep(0.5)

        print(f"\n   📊 Summary: patched={patched}, still_missing={still_missing}")
        return {"patched": patched, "still_missing": still_missing, "total_checked": len(missing)}


def main():
    parser = argparse.ArgumentParser(description="Patch missing RPE values from Nolio API")
    parser.add_argument("--since-days", type=int, default=None, help="Lookback in days (None=all history)")
    parser.add_argument("--athlete", type=str, default=None, help="Filter by athlete first name")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    db = DBConnector()
    nolio = NolioClient()
    patcher = RPEPatcher(db, nolio)
    patcher.run(since_days=args.since_days, dry_run=args.dry_run, athlete_filter=args.athlete)


if __name__ == "__main__":
    main()
