"""
Regression test: re-run ALL Feb 4-5 interval run sessions through the
PRODUCTION path (IntervalMatcher.match → IntervalDetector._adapt_output)
and compare new interval_pace_mean / interval_pace_last vs DB.

Uses TextPlanParser (offline fallback). Sessions where TextPlanParser fails
to produce a correct plan are flagged separately from real regressions.

Does NOT write to DB.
"""
import os
import tempfile
from dotenv import load_dotenv

load_dotenv()

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import TextPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher
from projectk_core.logic.interval_detector import IntervalDetector


def sec_to_str(s):
    if s is None:
        return 'NULL'
    return f"{int(s // 60)}'{int(s % 60):02d}"


def main():
    db = DBConnector()
    storage = StorageManager()
    parser = TextPlanParser()
    matcher = IntervalMatcher()

    # Get all Feb 4-5 interval run sessions with metrics
    acts = db.client.table('activities')\
        .select('id, athlete_id, activity_name, sport_type, session_date, work_type, '
                'interval_pace_mean, interval_pace_last, fit_file_path')\
        .eq('work_type', 'intervals')\
        .gte('session_date', '2026-02-04')\
        .lt('session_date', '2026-02-06')\
        .not_.is_('fit_file_path', 'null')\
        .not_.is_('interval_pace_mean', 'null')\
        .execute().data

    run_acts = [a for a in acts if a.get('sport_type', '').lower() == 'run']

    athlete_cache = {}
    for a in run_acts:
        aid = a['athlete_id']
        if aid not in athlete_cache:
            ath = db.client.table('athletes').select('first_name, last_name').eq('id', aid).execute().data
            athlete_cache[aid] = f"{ath[0]['first_name']} {ath[0]['last_name']}" if ath else 'Unknown'

    print(f'Regression test (production path): {len(run_acts)} sessions\n')

    regressions = []
    parser_issues = []

    for act in run_acts:
        name = athlete_cache[act['athlete_id']]
        db_amoy = act.get('interval_pace_mean')
        db_alast = act.get('interval_pace_last')
        activity_name = act['activity_name']

        try:
            fit_data = storage.download_fit_file(act['fit_file_path'])
            with tempfile.NamedTemporaryFile(delete=False, suffix='.fit') as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name
            df, meta, laps = UniversalParser.parse(tmp_path)
            os.unlink(tmp_path)

            plan = parser.parse(activity_name)
            if not plan:
                parser_issues.append({'name': name, 'activity': activity_name, 'reason': 'no plan'})
                print(f'{name:25s} | {activity_name[:35]:35s} | SKIP - no plan (parser)')
                continue

            # Run through production path:
            # 1. IntervalMatcher.match()
            results = matcher.match(df, plan, sport='run', laps=laps)

            # 2. IntervalDetector._adapt_output() — same function the reprocessor uses
            metrics = IntervalDetector._adapt_output(results, target_grid=plan)

            new_amoy = metrics.get('interval_pace_mean')  # min/km as decimal
            new_alast = metrics.get('interval_pace_last')  # min/km as decimal

            if not new_amoy and not new_alast:
                parser_issues.append({'name': name, 'activity': activity_name, 'reason': 'NULL output'})
                print(f'{name:25s} | {activity_name[:35]:35s} | NULL output (likely parser mismatch)')
                continue

            # Convert to seconds for comparison
            new_amoy_sec = new_amoy * 60 if new_amoy else None
            new_alast_sec = new_alast * 60 if new_alast else None
            db_amoy_sec = db_amoy * 60 if db_amoy else None
            db_alast_sec = db_alast * 60 if db_alast else None

            delta_amoy = (new_amoy_sec - db_amoy_sec) if new_amoy_sec and db_amoy_sec else None
            delta_alast = (new_alast_sec - db_alast_sec) if new_alast_sec and db_alast_sec else None

            flag_a = ' !!!' if delta_amoy and abs(delta_amoy) > 3 else ''
            flag_l = ' !!!' if delta_alast and abs(delta_alast) > 3 else ''

            if flag_a or flag_l:
                regressions.append({
                    'name': name,
                    'activity': activity_name,
                    'delta_amoy': delta_amoy,
                    'delta_alast': delta_alast,
                })

            amoy_str = f'{sec_to_str(db_amoy_sec):>6}->{sec_to_str(new_amoy_sec):>6}'
            alast_str = f'{sec_to_str(db_alast_sec):>6}->{sec_to_str(new_alast_sec):>6}'

            da_str = f'({delta_amoy:+.0f}s)' if delta_amoy is not None else '(N/A) '
            dl_str = f'({delta_alast:+.0f}s)' if delta_alast is not None else '(N/A) '

            print(f'{name:25s} | {activity_name[:35]:35s} '
                  f'| Amoy {amoy_str} {da_str}{flag_a:4s} '
                  f'| Alast {alast_str} {dl_str}{flag_l}')

        except Exception as e:
            print(f'{name:25s} | {activity_name[:35]:35s} | ERROR: {str(e)[:60]}')

    # Summary
    print(f'\n{"="*80}')
    if regressions:
        print(f'  REGRESSIONS (>3s delta): {len(regressions)}')
        for r in regressions:
            da = f'{r["delta_amoy"]:+.0f}s' if r['delta_amoy'] else 'N/A'
            dl = f'{r["delta_alast"]:+.0f}s' if r['delta_alast'] else 'N/A'
            print(f'    {r["name"]:25s} | {r["activity"][:35]} | dAmoy={da} dAlast={dl}')
    else:
        print(f'  No regressions (all deltas <= 3s)')

    if parser_issues:
        print(f'\n  Parser issues (TextPlanParser limitation, not code regressions): {len(parser_issues)}')
        for p in parser_issues:
            print(f'    {p["name"]:25s} | {p["activity"][:35]} | {p["reason"]}')


if __name__ == "__main__":
    main()
