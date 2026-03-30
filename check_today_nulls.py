#!/usr/bin/env python3
"""
Analyse des séances d'intervalles importées aujourd'hui avec métriques NULL.
"""
from datetime import datetime, timedelta
from projectk_core.db.connector import DBConnector

db = DBConnector()

# Get interval activities imported today
today = datetime.now().date()
yesterday = today - timedelta(days=1)

print("=" * 70)
print(f"📊 ANALYSE DES SÉANCES D'INTERVALLES AUJOURD'HUI ({today})")
print("=" * 70)

# Query activities with work_type = 'intervals' imported recently
acts = db.client.table('activities')\
    .select('id, athlete_id, activity_name, sport_type, session_date, work_type, interval_power_mean, interval_hr_mean, interval_pace_mean, created_at')\
    .eq('work_type', 'intervals')\
    .gte('session_date', str(yesterday))\
    .order('created_at', desc=True)\
    .limit(50)\
    .execute().data

print(f"\n📋 {len(acts)} séances d'intervalles récentes trouvées\n")

# Get athlete names
athlete_ids = list(set(a['athlete_id'] for a in acts))
athletes = db.client.table('athletes').select('id, first_name, last_name').in_('id', athlete_ids).execute().data
athlete_map = {a['id']: f"{a['first_name']} {a['last_name']}" for a in athletes}

null_count = 0
has_data_count = 0

for act in acts:
    name = athlete_map.get(act['athlete_id'], 'Unknown')
    activity_name = act.get('activity_name') or '(sans nom)'
    sport = act.get('sport_type', 'unknown')

    p_mean = act.get('interval_power_mean')
    hr_mean = act.get('interval_hr_mean')
    pace_mean = act.get('interval_pace_mean')

    # Check if ALL interval metrics are NULL
    all_null = (p_mean is None and hr_mean is None and pace_mean is None)

    if all_null:
        null_count += 1
        print(f"❌ NULL | {name:20} | {sport:6} | {activity_name[:40]}")
    else:
        has_data_count += 1
        metrics = []
        if p_mean: metrics.append(f"P={p_mean}W")
        if hr_mean: metrics.append(f"HR={hr_mean}")
        if pace_mean: metrics.append(f"Pace={pace_mean}")
        print(f"✅ OK   | {name:20} | {sport:6} | {activity_name[:40]} | {', '.join(metrics)}")

print("\n" + "=" * 70)
print(f"📊 RÉSUMÉ")
print("=" * 70)
print(f"  ✅ Avec métriques: {has_data_count}")
print(f"  ❌ NULL:          {null_count}")
print(f"  📈 Taux de succès: {has_data_count / len(acts) * 100:.1f}%" if acts else "N/A")
