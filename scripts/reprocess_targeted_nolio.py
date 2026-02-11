#!/usr/bin/env python3
"""
Targeted reprocess for selected Nolio IDs with before/after report.
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.logic.reprocessor import ReprocessingEngine

SNAPSHOT_FIELDS = [
    "session_date",
    "sport_type",
    "activity_name",
    "durability_index",
    "decoupling_index",
    "interval_power_mean",
    "interval_power_last",
    "interval_hr_mean",
    "interval_hr_last",
    "interval_pace_mean",
    "interval_pace_last",
    "interval_detection_source",
    "session_group_id",
    "session_group_type",
    "session_group_role",
    "session_group_order",
]

QUERY_COLS_FULL = (
    "id, nolio_id, athlete_id, fit_file_path, sport_type, session_date, rpe, activity_name, "
    "load_index, "
    "durability_index, decoupling_index, interval_power_mean, interval_power_last, "
    "interval_hr_mean, interval_hr_last, interval_pace_mean, interval_pace_last, "
    "interval_detection_source, session_group_id, session_group_type, session_group_role, "
    "session_group_order, segmented_metrics"
)

QUERY_COLS_FALLBACK = (
    "id, nolio_id, athlete_id, fit_file_path, sport_type, session_date, rpe, activity_name, "
    "load_index, "
    "durability_index, decoupling_index, interval_power_mean, interval_power_last, "
    "interval_hr_mean, interval_hr_last, interval_pace_mean, interval_pace_last, "
    "interval_detection_source, segmented_metrics"
)


def parse_nolio_ids(raw_values: List[str], ids_file: str = "") -> List[str]:
    all_ids: List[str] = []
    for raw in raw_values:
        if not raw:
            continue
        all_ids.extend([part.strip() for part in raw.split(",") if part.strip()])

    if ids_file:
        with open(ids_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    all_ids.append(line)

    # stable de-dup
    seen = set()
    unique: List[str] = []
    for nid in all_ids:
        if nid not in seen:
            seen.add(nid)
            unique.append(nid)
    return unique


def extract_interval_blocks(segmented_metrics: Any) -> Dict[str, Any]:
    result = {
        "interval_blocks_count": 0,
        "interval_block_1_pace_mean": None,
        "interval_block_1_pace_last": None,
        "interval_block_2_pace_mean": None,
        "interval_block_2_pace_last": None,
    }
    if not isinstance(segmented_metrics, dict):
        return result

    blocks = segmented_metrics.get("interval_blocks")
    if not isinstance(blocks, list):
        return result

    result["interval_blocks_count"] = len(blocks)
    if len(blocks) >= 1 and isinstance(blocks[0], dict):
        result["interval_block_1_pace_mean"] = blocks[0].get("interval_pace_mean")
        result["interval_block_1_pace_last"] = blocks[0].get("interval_pace_last")
    if len(blocks) >= 2 and isinstance(blocks[1], dict):
        result["interval_block_2_pace_mean"] = blocks[1].get("interval_pace_mean")
        result["interval_block_2_pace_last"] = blocks[1].get("interval_pace_last")

    return result


def snapshot_activity(row: Dict[str, Any]) -> Dict[str, Any]:
    snap = {k: row.get(k) for k in SNAPSHOT_FIELDS}
    snap.update(extract_interval_blocks(row.get("segmented_metrics")))
    return snap


def diff_snapshots(before: Dict[str, Any], after: Dict[str, Any]) -> List[Tuple[str, Any, Any]]:
    keys = sorted(set(before.keys()).union(after.keys()))
    diffs = []
    for key in keys:
        if before.get(key) != after.get(key):
            diffs.append((key, before.get(key), after.get(key)))
    return diffs


def build_report(
    report_path: str,
    target_ids: List[str],
    statuses: Dict[str, str],
    before_snaps: Dict[str, Dict[str, Any]],
    after_snaps: Dict[str, Dict[str, Any]],
) -> None:
    lines: List[str] = []
    lines.append("# Targeted Reprocess Report")
    lines.append("")
    lines.append(f"Generated: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"Target IDs: {', '.join(target_ids)}")
    lines.append("")
    lines.append("| nolio_id | status | changed_fields |")
    lines.append("|---|---:|---:|")

    all_diffs: Dict[str, List[Tuple[str, Any, Any]]] = {}
    for nid in target_ids:
        before = before_snaps.get(nid, {})
        after = after_snaps.get(nid, before)
        diffs = diff_snapshots(before, after)
        all_diffs[nid] = diffs
        lines.append(f"| {nid} | {statuses.get(nid, 'UNKNOWN')} | {len(diffs)} |")

    lines.append("")
    lines.append("## Detailed changes")
    lines.append("")

    for nid in target_ids:
        lines.append(f"### {nid}")
        diffs = all_diffs.get(nid, [])
        if not diffs:
            lines.append("No field change.")
            lines.append("")
            continue

        lines.append("| field | before | after |")
        lines.append("|---|---|---|")
        for field, before, after in diffs:
            lines.append(f"| `{field}` | `{before}` | `{after}` |")
        lines.append("")

    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def fetch_target_rows(db: DBConnector, target_ids: List[str]) -> List[Dict[str, Any]]:
    try:
        return db.client.table("activities").select(QUERY_COLS_FULL).in_("nolio_id", target_ids).execute().data
    except Exception as e:
        if "session_group_id" in str(e):
            return db.client.table("activities").select(QUERY_COLS_FALLBACK).in_("nolio_id", target_ids).execute().data
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Targeted reprocess by nolio_id with before/after report")
    parser.add_argument("--nolio-id", action="append", default=[], help="Nolio ID(s), comma-separated allowed")
    parser.add_argument("--nolio-id-file", default="", help="Text file with one nolio_id per line")
    parser.add_argument("--apply", action="store_true", help="Apply reprocess (default is dry-run)")
    parser.add_argument("--report-out", default="", help="Markdown report output path")
    args = parser.parse_args()

    target_ids = parse_nolio_ids(args.nolio_id, args.nolio_id_file)
    if not target_ids:
        raise SystemExit("No nolio_id provided.")

    db = DBConnector()
    rows = fetch_target_rows(db, target_ids)
    rows_by_nid = {str(r["nolio_id"]): r for r in rows}

    before_snaps = {nid: snapshot_activity(rows_by_nid[nid]) for nid in rows_by_nid}
    after_snaps = {nid: dict(before_snaps[nid]) for nid in before_snaps}
    statuses = {nid: "MISSING" for nid in target_ids}

    athletes = db.client.table("athletes").select("id, nolio_id").execute().data
    athlete_nolio_map = {a["id"]: a.get("nolio_id") for a in athletes}

    if args.apply:
        engine = ReprocessingEngine(offline_mode=False)
        for nid in target_ids:
            row = rows_by_nid.get(nid)
            if not row:
                continue
            statuses[nid] = "APPLIED"
            athlete_nolio_id = athlete_nolio_map.get(row["athlete_id"])
            try:
                engine.recalculate_activity(row["athlete_id"], row, athlete_nolio_id=athlete_nolio_id)
            except Exception as e:
                statuses[nid] = f"ERROR: {e}"

        refreshed = fetch_target_rows(db, target_ids)
        refreshed_by_nid = {str(r["nolio_id"]): r for r in refreshed}
        for nid in target_ids:
            if nid in refreshed_by_nid:
                after_snaps[nid] = snapshot_activity(refreshed_by_nid[nid])
            elif nid in before_snaps:
                after_snaps[nid] = dict(before_snaps[nid])
    else:
        for nid in target_ids:
            if nid in rows_by_nid:
                statuses[nid] = "DRY_RUN"

    if not args.report_out:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        args.report_out = os.path.join("scripts", "reports", f"reprocess_targeted_{ts}.md")

    build_report(args.report_out, target_ids, statuses, before_snaps, after_snaps)

    print(f"Report generated: {args.report_out}")
    print("Statuses:")
    for nid in target_ids:
        print(f" - {nid}: {statuses.get(nid, 'UNKNOWN')}")


if __name__ == "__main__":
    main()
