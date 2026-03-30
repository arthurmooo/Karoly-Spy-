"""
Verification script for pace precision fix.

1. Snapshots ALL Feb 5 interval session metrics (before reprocessing)
2. Reprocesses ALL Feb 5 interval sessions
3. Compares before/after for EVERY session
4. Asserts: only the 4 problematic sessions changed significantly (>2s delta)
5. Asserts: the 4 problematic sessions now match SOT within ±2s
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from projectk_core.db.connector import DBConnector
from projectk_core.logic.reprocessor import ReprocessingEngine


# SOT (Source of Truth) from Nolio — pace in seconds per km
SOT = {
    "Margot Sellem": {"amoy": 4 * 60 + 37, "alast": 4 * 60 + 36},
    "Adrien Patras": {"amoy": 3 * 60 + 43, "alast": 3 * 60 + 35},
    "Franck Dupeu": {"amoy": 4 * 60 + 24, "alast": 4 * 60 + 15},
    "Christophe Rivart": {"amoy": None, "alast": 4 * 60 + 8},
}


def pace_to_str(pace_min):
    """Convert pace in minutes/km to mm'ss string."""
    if pace_min is None:
        return "N/A"
    total_sec = pace_min * 60
    m = int(total_sec // 60)
    s = int(total_sec % 60)
    return f"{m}'{s:02d}"


def pace_to_sec(pace_min):
    """Convert pace in minutes/km to total seconds/km."""
    if pace_min is None:
        return None
    return pace_min * 60


def main():
    db = DBConnector()
    engine = ReprocessingEngine(offline_mode=True)

    # Step 1: Find ALL Feb 5 interval sessions for running
    print("=" * 70)
    print("  STEP 1: Snapshot ALL Feb 5 interval sessions")
    print("=" * 70)

    acts = db.client.table('activities')\
        .select('id, athlete_id, activity_name, sport_type, session_date, work_type, '
                'interval_pace_mean, interval_pace_last, fit_file_path, nolio_id, rpe')\
        .eq('session_date', '2026-02-05')\
        .eq('work_type', 'intervals')\
        .eq('sport_type', 'run')\
        .not_.is_('fit_file_path', 'null')\
        .execute().data

    if not acts:
        print("  No Feb 5 interval sessions found!")
        return

    # Enrich with athlete names
    athlete_cache = {}
    for act in acts:
        aid = act['athlete_id']
        if aid not in athlete_cache:
            ath = db.client.table('athletes')\
                .select('id, first_name, last_name, nolio_id')\
                .eq('id', aid)\
                .execute().data
            athlete_cache[aid] = ath[0] if ath else None
        act['_athlete'] = athlete_cache[aid]
        act['_athlete_name'] = f"{act['_athlete']['first_name']} {act['_athlete']['last_name']}" if act['_athlete'] else "Unknown"

    print(f"  Found {len(acts)} interval sessions:\n")
    for act in acts:
        amoy = pace_to_str(act.get('interval_pace_mean'))
        alast = pace_to_str(act.get('interval_pace_last'))
        print(f"  {act['_athlete_name']:25s} | {act['activity_name'][:40]:40s} | Amoy={amoy:>6} | Alast={alast:>6}")

    # Save snapshot
    snapshot = {}
    for act in acts:
        snapshot[act['id']] = {
            'athlete_name': act['_athlete_name'],
            'activity_name': act['activity_name'],
            'amoy_before': act.get('interval_pace_mean'),
            'alast_before': act.get('interval_pace_last'),
        }

    # Step 2: Reprocess ALL
    print(f"\n{'='*70}")
    print("  STEP 2: Reprocessing ALL Feb 5 interval sessions")
    print("=" * 70)

    for i, act in enumerate(acts):
        athlete = act['_athlete']
        if not athlete:
            print(f"  [{i+1}/{len(acts)}] ❌ No athlete for {act['id']}")
            continue

        print(f"  [{i+1}/{len(acts)}] Reprocessing {act['_athlete_name']:25s} — {act['activity_name'][:40]}")
        try:
            engine.recalculate_activity(
                athlete_id=athlete['id'],
                act_record={
                    'id': act['id'],
                    'nolio_id': act.get('nolio_id'),
                    'fit_file_path': act['fit_file_path'],
                    'sport_type': act['sport_type'],
                    'session_date': act['session_date'],
                    'rpe': act.get('rpe'),
                    'activity_name': act['activity_name'],
                },
                athlete_nolio_id=athlete.get('nolio_id')
            )
        except Exception as e:
            print(f"           ❌ Error: {e}")

    # Step 3: Compare before/after
    print(f"\n{'='*70}")
    print("  STEP 3: Before/After Comparison")
    print("=" * 70)

    regressions = []
    fixes = []

    for act in acts:
        # Re-fetch from DB
        updated = db.client.table('activities')\
            .select('interval_pace_mean, interval_pace_last')\
            .eq('id', act['id'])\
            .execute().data

        if not updated:
            continue

        upd = updated[0]
        snap = snapshot[act['id']]
        snap['amoy_after'] = upd.get('interval_pace_mean')
        snap['alast_after'] = upd.get('interval_pace_last')

        amoy_before_sec = pace_to_sec(snap['amoy_before'])
        amoy_after_sec = pace_to_sec(snap['amoy_after'])
        alast_before_sec = pace_to_sec(snap['alast_before'])
        alast_after_sec = pace_to_sec(snap['alast_after'])

        amoy_delta = abs(amoy_after_sec - amoy_before_sec) if amoy_before_sec and amoy_after_sec else 0
        alast_delta = abs(alast_after_sec - alast_before_sec) if alast_before_sec and alast_after_sec else 0
        max_delta = max(amoy_delta, alast_delta)

        is_target = snap['athlete_name'] in SOT
        status = ""

        if max_delta > 2:
            if is_target:
                status = "✅ FIXED"
                fixes.append(snap)
            else:
                status = "⚠️  REGRESSION"
                regressions.append(snap)
        else:
            status = "✅ STABLE" if not is_target else "⚠️  NO CHANGE (expected fix)"

        print(f"\n  {snap['athlete_name']:25s} | {snap['activity_name'][:40]}")
        print(f"    Amoy:  {pace_to_str(snap['amoy_before']):>6} → {pace_to_str(snap['amoy_after']):>6}  (Δ {amoy_delta:+.0f}s)")
        print(f"    Alast: {pace_to_str(snap['alast_before']):>6} → {pace_to_str(snap['alast_after']):>6}  (Δ {alast_delta:+.0f}s)")
        print(f"    {status}")

        # SOT check for target athletes
        if is_target:
            sot = SOT[snap['athlete_name']]
            if sot.get('amoy') and amoy_after_sec:
                amoy_vs_sot = abs(amoy_after_sec - sot['amoy'])
                ok = "✅" if amoy_vs_sot <= 2 else "❌"
                print(f"    vs SOT Amoy:  {ok} Δ={amoy_vs_sot:.0f}s (target ≤2s)")
            if sot.get('alast') and alast_after_sec:
                alast_vs_sot = abs(alast_after_sec - sot['alast'])
                ok = "✅" if alast_vs_sot <= 2 else "❌"
                print(f"    vs SOT Alast: {ok} Δ={alast_vs_sot:.0f}s (target ≤2s)")

    # Summary
    print(f"\n{'='*70}")
    print("  SUMMARY")
    print("=" * 70)
    print(f"  Total sessions:   {len(acts)}")
    print(f"  Fixed (target):   {len(fixes)}")
    print(f"  Regressions:      {len(regressions)}")

    if regressions:
        print(f"\n  ⚠️  REGRESSIONS DETECTED:")
        for r in regressions:
            print(f"    - {r['athlete_name']} | {r['activity_name']}")
    else:
        print(f"\n  ✅ No regressions detected!")


if __name__ == "__main__":
    main()
