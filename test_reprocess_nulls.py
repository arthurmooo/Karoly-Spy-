#!/usr/bin/env python3
"""
Test du nouveau moteur sur les séances NULL.
"""
from projectk_core.db.connector import DBConnector
from projectk_core.logic.reprocessor import ReprocessingEngine

db = DBConnector()

# Test cases - NULL séances d'intervalles identifiées
test_cases = [
    ("Thierry Legagnoux", "10*2' Z2/ r 1'"),       # Time-based intervals
    ("Thomas Clatot", "4*(500m Z3 + 1000m Z2)"),   # Complex pattern
    ("Kylian Herpin", "7*3' Z3/ r 1'30''"),        # Time-based
    ("Alin Brinza", "20*1'30'' Z2/ r 45''"),       # Compound duration (was parsing bug)
    ("Robin Lemercier", "15*1' Z2/ r 1'"),         # Short intervals
    ("Lucas Hzg", "3*10' Z2/ r 2'"),               # Long intervals
]

print("=" * 70)
print("🧪 TEST REPROCESSING SUR SÉANCES NULL")
print("=" * 70)

# Get activities by name pattern
for athlete_name, activity_pattern in test_cases:
    print(f"\n🔍 Testing: {athlete_name} - {activity_pattern}")

    # Find the activity
    parts = athlete_name.split()
    first_name = parts[0]

    acts = db.client.table('activities')\
        .select('id, athlete_id, activity_name, interval_power_mean, interval_hr_mean, interval_pace_mean, fit_file_path, nolio_id, session_date, sport_type, rpe')\
        .ilike('activity_name', f'%{activity_pattern[:20]}%')\
        .limit(5)\
        .execute().data

    if not acts:
        print(f"   ⚠️ Activity not found")
        continue

    # Find the right athlete
    athlete = db.client.table('athletes').select('id, first_name, last_name, nolio_id').ilike('first_name', f'%{first_name}%').execute().data
    if not athlete:
        print(f"   ⚠️ Athlete not found")
        continue

    athlete = athlete[0]
    act = None
    for a in acts:
        if a['athlete_id'] == athlete['id']:
            act = a
            break

    if not act:
        print(f"   ⚠️ Activity not found for this athlete")
        continue

    # Current state
    p = act.get('interval_power_mean')
    hr = act.get('interval_hr_mean')
    pace = act.get('interval_pace_mean')
    print(f"   AVANT: P={p}, HR={hr}, Pace={pace}")

    # Test reprocessing
    engine = ReprocessingEngine(offline_mode=True)

    try:
        engine.recalculate_activity(
            athlete['id'],
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
        print(f"   ✅ Reprocessed successfully")

        # Check result
        updated = db.client.table('activities').select('interval_power_mean, interval_hr_mean, interval_pace_mean').eq('id', act['id']).execute().data[0]
        p2 = updated.get('interval_power_mean')
        hr2 = updated.get('interval_hr_mean')
        pace2 = updated.get('interval_pace_mean')
        print(f"   APRÈS: P={p2}, HR={hr2}, Pace={pace2}")

        if p2 or hr2 or pace2:
            print(f"   🎉 FIXED!")
        else:
            print(f"   ❌ Still NULL")

    except Exception as e:
        print(f"   ❌ Error: {e}")
