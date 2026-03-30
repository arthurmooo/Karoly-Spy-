#!/usr/bin/env python3
"""
Reprocess ALL null interval sessions from today to measure improvement.
"""
from datetime import datetime, timedelta
from projectk_core.db.connector import DBConnector
from projectk_core.logic.reprocessor import ReprocessingEngine

db = DBConnector()
engine = ReprocessingEngine(offline_mode=True)

# Get today's NULL interval activities (exclude Swim)
today = datetime.now().date()
yesterday = today - timedelta(days=1)

acts = db.client.table('activities')\
    .select('id, athlete_id, activity_name, sport_type, session_date, nolio_id, fit_file_path, rpe, interval_power_mean, interval_hr_mean, interval_pace_mean')\
    .eq('work_type', 'intervals')\
    .neq('sport_type', 'Swim')\
    .gte('session_date', str(yesterday))\
    .is_('interval_power_mean', 'null')\
    .is_('interval_hr_mean', 'null')\
    .is_('interval_pace_mean', 'null')\
    .not_.is_('fit_file_path', 'null')\
    .execute().data

# Get athlete info
athlete_ids = list(set(a['athlete_id'] for a in acts))
athletes_data = db.client.table('athletes').select('id, first_name, last_name, nolio_id').in_('id', athlete_ids).execute().data
athlete_map = {a['id']: a for a in athletes_data}

print("=" * 70)
print(f"🔄 REPROCESSING {len(acts)} SÉANCES NULL (hors Swim)")
print("=" * 70)

fixed = 0
still_null = 0
errors = 0

for act in acts:
    athlete = athlete_map.get(act['athlete_id'], {})
    name = f"{athlete.get('first_name', '?')} {athlete.get('last_name', '')}"
    activity_name = act.get('activity_name') or '(sans nom)'

    print(f"\n🔄 {name} - {activity_name[:50]}")

    try:
        engine.recalculate_activity(
            act['athlete_id'],
            {
                'id': act['id'],
                'nolio_id': act.get('nolio_id'),
                'fit_file_path': act.get('fit_file_path'),
                'sport_type': act.get('sport_type'),
                'session_date': act.get('session_date'),
                'rpe': act.get('rpe'),
                'activity_name': act.get('activity_name')
            },
            athlete_nolio_id=athlete.get('nolio_id')
        )

        # Check result
        updated = db.client.table('activities')\
            .select('interval_power_mean, interval_hr_mean, interval_pace_mean')\
            .eq('id', act['id']).execute().data[0]

        has_data = updated.get('interval_power_mean') or updated.get('interval_hr_mean') or updated.get('interval_pace_mean')

        if has_data:
            fixed += 1
            print(f"   🎉 FIXED! P={updated.get('interval_power_mean')}, HR={updated.get('interval_hr_mean')}, Pace={updated.get('interval_pace_mean')}")
        else:
            still_null += 1
            print(f"   ⚠️ Still NULL (likely incomplete session)")

    except Exception as e:
        errors += 1
        print(f"   ❌ Error: {str(e)[:50]}")

print("\n" + "=" * 70)
print("📊 RÉSUMÉ REPROCESSING")
print("=" * 70)
print(f"  🎉 Corrigés:     {fixed}")
print(f"  ⚠️ Still NULL:   {still_null} (séances incomplètes)")
print(f"  ❌ Erreurs:      {errors}")
print(f"\n  📈 Amélioration: {fixed}/{fixed+still_null} ({fixed/(fixed+still_null)*100:.1f}% fixables)" if (fixed+still_null) > 0 else "")
