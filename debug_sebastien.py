#!/usr/bin/env python3
"""Debug Sebastien Sahyoun's HIT session error"""
import traceback
from projectk_core.db.connector import DBConnector
from projectk_core.logic.reprocessor import ReprocessingEngine

db = DBConnector()

# Find the activity
act = db.client.table('activities')\
    .select('*')\
    .ilike('activity_name', '%LIT + HIT 30*8-52%')\
    .execute().data

if act:
    act = act[0]
    print(f"Found: {act['activity_name']}")

    # Get athlete
    athlete = db.client.table('athletes').select('*').eq('id', act['athlete_id']).execute().data[0]
    print(f"Athlete: {athlete['first_name']} {athlete['last_name']}")

    engine = ReprocessingEngine(offline_mode=True)

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
    except Exception as e:
        print(f"\n❌ FULL ERROR:")
        traceback.print_exc()
