"""
Audit diagnostic — 4 séances signalées par Karoly
===================================================
Pour chaque séance:
1. Télécharge le FIT depuis Supabase Storage
2. Parse les LAPs bruts (UniversalParser)
3. Récupère le plan (Nolio ou TextPlanParser)
4. Lance IntervalMatcher.match() et IntervalDetector.detect()
5. Compare LAPs FIT vs intervalles détectés

Usage:
    python scripts/audit_6_sessions.py
"""

import sys, os, tempfile, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser, TextPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.logic.interval_detector import IntervalDetector
from projectk_core.logic.models import Activity, ActivityMetadata
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.logic.profile_manager import ProfileManager

# ── Sessions à auditer ──────────────────────────────────────────────
SESSIONS = [
    {
        "id": "e3f18289-d5e9-4ccf-acc8-e00578489fa4",
        "label": "Driess Matthys — 3x9Km progressif (01/03/2026)",
        "expected_intervals": 3,
        "sot_pace_last": "3'24/km",
    },
    {
        "id": "82bec227-193f-466f-a65f-cd2b3cc0068f",
        "label": "Steven Galibert — 40Km Tempo (25/02/2026)",
        "expected_intervals": 2,
        "sot_pace_last": "3'21/km",
    },
    {
        "id": "fc03a51a-9718-4372-9545-ef17ca190a6a",
        "label": "Steven Galibert — 2x5Km Z2 (28/02/2026)",
        "expected_intervals": 2,
        "sot_pace_last": "N/A (aucune stat)",
    },
    {
        "id": "1f8cdd28-5f6e-428d-9949-8b2c6dd0c329",
        "label": "Hadrien Tabou — 4x30' Tempo vélo (21/02/2026)",
        "expected_intervals": 4,
        "sot_power_last": "~283W",
    },
]

def fmt_pace(speed_ms):
    """m/s → min'sec''/km"""
    if not speed_ms or speed_ms <= 0:
        return "N/A"
    pace_sec = 1000.0 / speed_ms
    m = int(pace_sec // 60)
    s = int(pace_sec % 60)
    return f"{m}'{s:02d}''/km"

def fmt_dur(seconds):
    """seconds → Xm Ys"""
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}m{s:02d}s"

def print_separator():
    print("\n" + "=" * 90)

def audit_session(session_info, db, storage, nolio_plan_parser, text_plan_parser, profile_manager):
    activity_id = session_info["id"]
    print_separator()
    print(f"  {session_info['label']}")
    print(f"  ID: {activity_id}")
    print(f"  SOT pace_last: {session_info.get('sot_pace_last', session_info.get('sot_power_last', 'N/A'))}")
    print("=" * 90)

    # ── 1. Fetch activity from DB ──
    act = db.client.table("activities") \
        .select("id, athlete_id, nolio_id, fit_file_path, sport_type, session_date, activity_name, source_json, segmented_metrics, interval_pace_last, interval_pace_mean, interval_power_last, interval_power_mean") \
        .eq("id", activity_id) \
        .execute().data

    if not act:
        print("  ❌ ACTIVITE INTROUVABLE EN BDD")
        return
    act = act[0]

    print(f"\n  [DB] activity_name: {act.get('activity_name')}")
    print(f"  [DB] sport_type:    {act.get('sport_type')}")
    print(f"  [DB] fit_file_path: {act.get('fit_file_path')}")
    print(f"  [DB] interval_pace_last (BDD): {act.get('interval_pace_last')}")
    print(f"  [DB] interval_pace_mean (BDD): {act.get('interval_pace_mean')}")
    print(f"  [DB] interval_power_last (BDD): {act.get('interval_power_last')}")
    print(f"  [DB] interval_power_mean (BDD): {act.get('interval_power_mean')}")
    seg = act.get('segmented_metrics') or {}
    interval_blocks = seg.get('interval_blocks', [])
    print(f"  [DB] interval_blocks (BDD): {json.dumps(interval_blocks, indent=2) if interval_blocks else '[]'}")

    # ── 2. Fetch existing activity_intervals ──
    intervals_db = db.client.table("activity_intervals") \
        .select("*") \
        .eq("activity_id", activity_id) \
        .order("start_time") \
        .execute().data

    if intervals_db:
        print(f"\n  [DB] activity_intervals ({len(intervals_db)} rows):")
        for idx_iv, iv in enumerate(intervals_db):
            src = iv.get('detection_source', '?')
            dur = iv.get('duration', 0) or 0
            spd = iv.get('avg_speed')
            pwr = iv.get('avg_power')
            hr = iv.get('avg_hr')
            respect = iv.get('respect_score')
            parts = []
            if spd: parts.append(f"speed={spd:.3f}m/s ({fmt_pace(spd)})")
            if pwr: parts.append(f"power={pwr:.1f}W")
            if hr: parts.append(f"hr={hr:.0f}bpm")
            if respect: parts.append(f"respect={respect:.1f}")
            print(f"    #{idx_iv+1} | {fmt_dur(dur)} | {src:6s} | {' | '.join(parts)}")
    else:
        print(f"\n  [DB] activity_intervals: AUCUNE")

    # ── 3. Download & Parse FIT ──
    fit_path = act.get('fit_file_path')
    if not fit_path:
        print("  ❌ Pas de fit_file_path — impossible de parser")
        return

    print(f"\n  Downloading FIT from storage: {fit_path}")
    try:
        fit_data = storage.download_fit_file(fit_path)
    except Exception as e:
        print(f"  ❌ Download failed: {e}")
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name

    try:
        df, device_meta, laps = UniversalParser.parse(tmp_path)
    except Exception as e:
        print(f"  ❌ Parse failed: {e}")
        os.remove(tmp_path)
        return

    print(f"  Parsed: {len(df)} rows (1Hz), {len(laps)} LAPs bruts")
    session_duration = len(df)

    # ── 4. LAPs bruts du FIT ──
    print(f"\n  ── LAPs BRUTS (FIT) ──")
    cumul_offset = 0
    for i, lap in enumerate(laps):
        dur = lap.get('total_timer_time', lap.get('total_elapsed_time', 0))
        dist = lap.get('total_distance', 0)
        avg_spd = lap.get('enhanced_avg_speed') or lap.get('avg_speed', 0)
        avg_pwr = lap.get('avg_power', 0)
        avg_hr = lap.get('avg_heart_rate', 0)
        start_time = lap.get('start_time', '')

        parts = [f"dist={dist:.0f}m"]
        if avg_spd: parts.append(f"speed={avg_spd:.3f}m/s ({fmt_pace(avg_spd)})")
        if avg_pwr: parts.append(f"power={avg_pwr:.0f}W")
        if avg_hr: parts.append(f"hr={avg_hr:.0f}bpm")
        parts.append(f"offset={cumul_offset}-{cumul_offset+int(dur)}s")

        print(f"    LAP {i+1:2d} | {fmt_dur(dur):>8s} | {' | '.join(parts)}")
        cumul_offset += int(dur)

    # ── 5. Parse Plan ──
    print(f"\n  ── PLAN ──")
    plan = None
    source_json = act.get('source_json')
    activity_title = act.get('activity_name', '')
    sport = act.get('sport_type', 'run')

    if source_json:
        structure_source = source_json.get('structured_workout')
        if not structure_source and source_json.get('planned_id'):
            # Can't fetch planned_id without API — use what we have
            pass
        if structure_source:
            plan = nolio_plan_parser.parse(structure_source, sport_type=sport, merge_adjacent_work=True)
            print(f"  Plan source: NolioPlanParser (structured_workout JSON)")

    if not plan and activity_title:
        plan = text_plan_parser.parse(activity_title)
        if plan:
            print(f"  Plan source: TextPlanParser from '{activity_title}'")

    if plan:
        print(f"  Plan: {len(plan)} target intervals")
        for j, t in enumerate(plan):
            dur = t.get('duration', 0)
            dist = t.get('distance_m', 0)
            tmin = t.get('target_min', 0)
            ttype = t.get('type', '?')
            target_type = t.get('target_type', 'time')
            merged = t.get('merged_from')
            composite = t.get('is_composite', False)
            parts = [f"type={ttype}", f"target_type={target_type}"]
            if dur: parts.append(f"dur={fmt_dur(dur)}")
            if dist: parts.append(f"dist={dist:.0f}m")
            if tmin: parts.append(f"target_min={tmin:.3f}")
            if merged: parts.append(f"merged_from={merged}")
            if composite: parts.append("COMPOSITE")
            print(f"    Target {j+1}: {' | '.join(parts)}")
    else:
        print(f"  Plan: AUCUN (pas de structure Nolio ni titre parsable)")

    # ── 6. Run IntervalMatcher.match() ──
    print(f"\n  ── INTERVAL MATCHER (replay) ──")
    if plan:
        # Determine sport
        raw_sport = sport.lower() if sport else 'run'
        matcher_sport = 'run'
        if 'bike' in raw_sport or 'cycl' in raw_sport or 'vélo' in raw_sport:
            matcher_sport = 'bike'

        # Get profile for CP
        athlete_id = act.get('athlete_id')
        session_date = datetime.fromisoformat(act['session_date'])
        profile = profile_manager.get_profile_for_date(athlete_id, sport, session_date) if athlete_id else None
        cp = None
        if profile:
            if matcher_sport == 'bike':
                cp = getattr(profile, 'cp', None) or getattr(profile, 'ftp', None)
            else:
                cp = getattr(profile, 'critical_speed', None) or getattr(profile, 'cs', None)
            print(f"  Physio profile found: CP/CS = {cp}")

        matcher = IntervalMatcher()
        matched = matcher.match(df, plan, sport=matcher_sport, laps=laps, cp=cp)

        print(f"\n  Matcher returned {len(matched)} matched intervals:")
        for k, m in enumerate(matched):
            src = m.get('source', '?')
            dur = m.get('duration_sec', 0)
            spd = m.get('avg_speed')
            pwr = m.get('avg_power')
            hr = m.get('avg_hr')
            conf = m.get('confidence', 0)
            start_i = m.get('start_index', 0)
            end_i = m.get('end_index', 0)
            target_idx = m.get('target_index', '?')

            parts = [f"target#{target_idx}"]
            if spd: parts.append(f"speed={spd:.3f}m/s ({fmt_pace(spd)})")
            if pwr: parts.append(f"power={pwr:.1f}W")
            if hr: parts.append(f"hr={hr:.0f}bpm")
            parts.append(f"conf={conf:.2f}")
            parts.append(f"range=[{start_i}-{end_i}]")

            # Check if this is a post-session artifact
            is_post_session = start_i > session_duration * 0.95
            flag = " ⚠️ POST-SESSION" if is_post_session else ""

            print(f"    Match {k+1} | {src:6s} | {fmt_dur(dur):>8s} | {' | '.join(parts)}{flag}")

        # ── 7. Run IntervalDetector._adapt_output() ──
        print(f"\n  ── _adapt_output() (pipeline complet) ──")
        adapted = IntervalDetector._adapt_output(matched, target_grid=plan)

        if adapted:
            print(f"  blocks: {len(adapted.get('blocks', []))}")
            print(f"  interval_pace_mean: {adapted.get('interval_pace_mean')}")
            print(f"  interval_pace_last: {adapted.get('interval_pace_last')}")
            print(f"  interval_power_mean: {adapted.get('interval_power_mean')}")
            print(f"  interval_power_last: {adapted.get('interval_power_last')}")
            print(f"  session_completion: {adapted.get('session_matched_intervals')}/{adapted.get('session_expected_intervals')} ({adapted.get('session_completion_ratio', 0)*100:.0f}%)")

            for b_idx, b in enumerate(adapted.get('blocks', [])):
                parts = []
                if b.get('avg_speed'): parts.append(f"speed={b['avg_speed']:.3f}m/s ({fmt_pace(b['avg_speed'])})")
                if b.get('avg_power'): parts.append(f"power={b['avg_power']:.1f}W")
                if b.get('avg_hr'): parts.append(f"hr={b['avg_hr']:.0f}bpm")
                parts.append(f"src={b.get('source', '?')}")
                print(f"    Block {b_idx+1}: {fmt_dur(b.get('duration_sec', 0))} | {' | '.join(parts)}")
        else:
            print(f"  _adapt_output() returned EMPTY — aucun intervalle retenu")

        # ── 8. Cross-reference LAPs FIT vs matched ──
        print(f"\n  ── DIAGNOSTIC: LAPs FIT vs Matches ──")
        matched_lap_indices = set()
        for m in matched:
            li = m.get('lap_index')
            if li is not None:
                if isinstance(li, list):
                    matched_lap_indices.update(li)
                else:
                    matched_lap_indices.add(li)

        # Preprocess laps like the matcher does
        preprocessed = matcher._preprocess_laps(laps, 'speed' if matcher_sport == 'run' else 'power', ref_intensity=cp)
        for i, plap in enumerate(preprocessed):
            status = "✅ MATCHED" if i in matched_lap_indices else "❌ SKIPPED"
            dur = plap['duration']
            dist = plap.get('total_distance', 0)
            intensity = plap.get('intensity', '?')
            avg_spd = plap.get('avg_speed', 0)
            avg_pwr = plap.get('avg_power', 0)
            avg_hr = plap.get('avg_hr', 0)

            parts = [f"intensity={intensity}"]
            if dist: parts.append(f"dist={dist:.0f}m")
            if avg_spd: parts.append(f"speed={avg_spd:.3f}m/s ({fmt_pace(avg_spd)})")
            if avg_pwr: parts.append(f"power={avg_pwr:.0f}W")
            if avg_hr: parts.append(f"hr={avg_hr:.0f}bpm")

            print(f"    pLAP {i:2d} | {fmt_dur(dur):>8s} | {status} | {' | '.join(parts)}")

        # ── 9. Simulate confidence scores for each LAP vs each target ──
        print(f"\n  ── CONFIDENCE MATRIX (LAP x Target) ──")
        signal_col = 'speed' if matcher_sport == 'run' else 'power'
        header = "       " + "".join(f"  T{j+1:02d}  " for j in range(len(plan)))
        print(header)
        for i, plap in enumerate(preprocessed):
            scores = []
            for t in plan:
                dur_s = int(t.get('duration', 0))
                t_min = float(t.get('target_min', 0) or 0)
                t_dist = float(t.get('distance_m', 0))
                conf = matcher._calculate_lap_confidence(plap, t_min, dur_s, signal_col, target_distance=t_dist)
                scores.append(f" {conf:.2f} ")
            status_char = "✓" if i in matched_lap_indices else "·"
            print(f"  L{i:02d} {status_char} |{'|'.join(scores)}|")

    else:
        print(f"  Pas de plan — impossible de replay le matcher")

    os.remove(tmp_path)
    print()


def main():
    print("=" * 90)
    print("  AUDIT DIAGNOSTIC — 4 séances signalées par Karoly")
    print("  Date: " + datetime.now().strftime("%Y-%m-%d %H:%M"))
    print("=" * 90)

    db = DBConnector()
    storage = StorageManager()
    nolio_plan_parser = NolioPlanParser()
    text_plan_parser = TextPlanParser()
    profile_manager = ProfileManager(db)

    for session in SESSIONS:
        try:
            audit_session(session, db, storage, nolio_plan_parser, text_plan_parser, profile_manager)
        except Exception as e:
            print(f"\n  ❌ ERREUR sur {session['label']}: {e}")
            import traceback
            traceback.print_exc()

    print_separator()
    print("  AUDIT TERMINÉ")
    print("=" * 90)


if __name__ == "__main__":
    main()
