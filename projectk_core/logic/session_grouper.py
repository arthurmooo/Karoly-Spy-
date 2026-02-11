import re
import uuid
from datetime import datetime, timedelta, timezone, date
from typing import Any, Dict, List, Optional, Tuple


class SessionGrouper:
    """
    Groups related activities (e.g. Bike + Run bricks) with a shared session_group_id.
    """

    def __init__(self, db_connector):
        self.db = db_connector

    def group_bricks_for_athlete_date(self, athlete_id: str, day_ref: Any) -> int:
        """
        Assigns session_group_* fields for Bike/Run pairs on the same day.
        Returns the number of grouped pairs.
        """
        day_start = self._to_day_start(day_ref)
        day_end = day_start + timedelta(days=1)

        try:
            rows = self.db.client.table("activities")\
                .select("id, nolio_id, session_date, sport_type, activity_name, source_json")\
                .eq("athlete_id", athlete_id)\
                .gte("session_date", day_start.isoformat())\
                .lt("session_date", day_end.isoformat())\
                .execute().data
        except Exception as e:
            print(f"      ⚠️ Brick grouping read skipped: {e}")
            return 0

        bikes = [r for r in rows if (r.get("sport_type") or "").lower() == "bike"]
        runs = [r for r in rows if (r.get("sport_type") or "").lower() == "run"]
        if not bikes or not runs:
            return 0

        # Reset existing grouping for Bike/Run activities on that day before recomputing.
        for row in bikes + runs:
            self._clear_group_fields(row["id"])

        grouped_pairs = self._find_pairs_for_day(bikes, runs, day_start.date())
        grouped_count = 0

        for bike_row, run_row in grouped_pairs:
            group_id = self._build_group_id(athlete_id, day_start.date(), bike_row, run_row)
            ok_bike = self._update_group_fields(
                activity_id=bike_row["id"],
                group_id=group_id,
                role="bike",
                order=1
            )
            ok_run = self._update_group_fields(
                activity_id=run_row["id"],
                group_id=group_id,
                role="run",
                order=2
            )
            if ok_bike and ok_run:
                grouped_count += 1

        return grouped_count

    def _find_pairs_for_day(
        self,
        bikes: List[Dict[str, Any]],
        runs: List[Dict[str, Any]],
        day_key: date
    ) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
        remaining_bikes = bikes[:]
        remaining_runs = runs[:]
        pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []

        while remaining_bikes and remaining_runs:
            best: Optional[Tuple[float, Dict[str, Any], Dict[str, Any]]] = None
            for b in remaining_bikes:
                for r in remaining_runs:
                    score = self._pair_score(b, r)
                    if score is None:
                        continue
                    if best is None or score > best[0]:
                        best = (score, b, r)

            if best is None:
                break

            _, best_bike, best_run = best
            pairs.append((best_bike, best_run))
            remaining_bikes = [b for b in remaining_bikes if b["id"] != best_bike["id"]]
            remaining_runs = [r for r in remaining_runs if r["id"] != best_run["id"]]

        return pairs

    def _pair_score(self, bike_row: Dict[str, Any], run_row: Dict[str, Any]) -> Optional[float]:
        bike_dt = self._parse_dt(bike_row.get("session_date"))
        run_dt = self._parse_dt(run_row.get("session_date"))
        if bike_dt is None or run_dt is None:
            return None

        # Bricks are bike -> run. Keep a small tolerance for clock drift.
        signed_gap = (run_dt - bike_dt).total_seconds()
        if signed_gap < -30 * 60:
            return None
        time_gap = abs(signed_gap)
        if time_gap > 6 * 3600:
            return None

        bike_plan = self._planned_name(bike_row)
        run_plan = self._planned_name(run_row)
        bike_label = bike_plan or bike_row.get("activity_name") or ""
        run_label = run_plan or run_row.get("activity_name") or ""
        similarity = self._name_similarity(bike_label, run_label)

        # Strict mode:
        # - If both planned names exist, require high similarity.
        # - If one planned name is missing/generic, allow tighter time proximity.
        if bike_plan and run_plan:
            if similarity < 0.55:
                return None
            name_score = 80 + (similarity * 20)
        else:
            if time_gap > 3 * 3600:
                return None
            bike_generic = self._is_generic_activity_label(bike_label)
            run_generic = self._is_generic_activity_label(run_label)
            if not (bike_generic or run_generic):
                return None
            if self._looks_structured_workout(bike_label) and self._looks_structured_workout(run_label):
                return None
            name_score = similarity * 25

        proximity_score = max(0.0, 40.0 - (time_gap / 300.0))
        return name_score + proximity_score

    def _build_group_id(
        self,
        athlete_id: str,
        day_key: date,
        bike_row: Dict[str, Any],
        run_row: Dict[str, Any]
    ) -> str:
        bike_nid = bike_row.get("nolio_id") or bike_row.get("id")
        run_nid = run_row.get("nolio_id") or run_row.get("id")
        raw_key = f"{athlete_id}:{day_key.isoformat()}:{bike_nid}:{run_nid}"
        return str(uuid.uuid5(uuid.NAMESPACE_URL, raw_key))

    def _update_group_fields(self, activity_id: str, group_id: str, role: str, order: int) -> bool:
        payload = {
            "session_group_id": group_id,
            "session_group_type": "brick",
            "session_group_role": role,
            "session_group_order": order
        }
        try:
            self.db.client.table("activities").update(payload).eq("id", activity_id).execute()
            return True
        except Exception as e:
            print(f"      ⚠️ Brick grouping update skipped ({activity_id}): {e}")
            return False

    def _clear_group_fields(self, activity_id: str) -> None:
        try:
            self.db.client.table("activities").update({
                "session_group_id": None,
                "session_group_type": None,
                "session_group_role": None,
                "session_group_order": None,
            }).eq("id", activity_id).execute()
        except Exception:
            # Best-effort cleanup; grouping can still continue.
            return

    def _planned_name(self, row: Dict[str, Any]) -> str:
        source_json = row.get("source_json") or {}
        return (source_json.get("planned_name") or "").strip()

    def _name_similarity(self, left: str, right: str) -> float:
        l = self._norm_text(left)
        r = self._norm_text(right)
        if not l or not r:
            return 0.0
        if l == r:
            return 1.0
        l_tokens = set(l.split())
        r_tokens = set(r.split())
        if not l_tokens or not r_tokens:
            return 0.0
        inter = len(l_tokens.intersection(r_tokens))
        union = len(l_tokens.union(r_tokens))
        return inter / union if union > 0 else 0.0

    def _norm_text(self, value: str) -> str:
        v = (value or "").lower().strip()
        v = re.sub(r"[^a-z0-9]+", " ", v)
        return re.sub(r"\s+", " ", v).strip()

    def _is_generic_activity_label(self, value: str) -> bool:
        raw = (value or "").lower().strip()
        if not raw:
            return True
        if raw.startswith("lit"):
            return True
        if any(k in raw for k in ["course à pied", "course a pied", "run", "bike", "vélo", "velo", "home trainer", "footing", "jog", "ride"]):
            return True
        v = self._norm_text(value)
        return v.startswith("lit") or v in {"course pied", "course a pied", "run", "bike", "velo", "ride"}

    def _looks_structured_workout(self, value: str) -> bool:
        v = (value or "").lower()
        return bool(re.search(r"\d+\s*[x*]\s*\d+|\d+\s*km|\bz[1-5]\b|tempo|seuil", v))

    def _parse_dt(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _to_day_start(self, value: Any) -> datetime:
        dt = self._parse_dt(value)
        if dt is None:
            dt = datetime.now(timezone.utc)
        return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
