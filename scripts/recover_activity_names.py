#!/usr/bin/env python3
"""
Script de récupération des noms d'activités depuis Nolio API.
À lancer une fois que le rate limit est levé (~1h après les 429).

Usage:
    python scripts/recover_activity_names.py [--dry-run] [--limit N]
"""

import argparse
import time
from datetime import datetime
from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.plan_parser import TextPlanParser
from projectk_core.logic.classifier import ActivityClassifier


def recover_activity_names(dry_run: bool = False, limit: int = None):
    db = DBConnector()
    nolio = NolioClient()
    parser = TextPlanParser()
    classifier = ActivityClassifier()

    # Get corrupted activities (empty name)
    query = db.client.table('activities')\
        .select('id, nolio_id, athlete_id, sport_type, fit_file_path')\
        .or_('activity_name.is.null,activity_name.eq.')\
        .not_.is_('fit_file_path', 'null')

    if limit:
        query = query.limit(limit)

    corrupted = query.execute().data
    print(f"📊 Activités à récupérer: {len(corrupted)}")

    # Get athlete nolio_ids
    athlete_ids = list(set(a['athlete_id'] for a in corrupted))
    athletes = db.client.table('athletes').select('id, nolio_id, first_name, last_name').in_('id', athlete_ids).execute().data
    athlete_map = {a['id']: {'nolio_id': a.get('nolio_id'), 'name': f"{a['first_name']} {a['last_name']}"} for a in athletes}

    recovered = 0
    failed = 0
    rate_limited = 0

    for i, act in enumerate(corrupted):
        nolio_id = act.get('nolio_id')
        athlete_info = athlete_map.get(act['athlete_id'], {})
        athlete_nolio_id = athlete_info.get('nolio_id')
        athlete_name = athlete_info.get('name', 'Unknown')

        if not nolio_id:
            print(f"  ⚠️ [{i+1}/{len(corrupted)}] No nolio_id for activity {act['id'][:8]}")
            continue

        try:
            details = nolio.get_activity_details(int(nolio_id), athlete_id=athlete_nolio_id)

            if details:
                name = details.get('planned_name') or details.get('name') or ""

                if name:
                    # Detect work_type from recovered name
                    work_type = classifier.detect_work_type_from_title(name)

                    if dry_run:
                        print(f"  🔍 [{i+1}/{len(corrupted)}] {athlete_name}: \"{name}\" -> {work_type}")
                    else:
                        # Update database
                        db.client.table('activities').update({
                            'activity_name': name,
                            'work_type': work_type,
                            'source_json': details  # Store for future reference
                        }).eq('id', act['id']).execute()
                        print(f"  ✅ [{i+1}/{len(corrupted)}] {athlete_name}: \"{name}\" -> {work_type}")

                    recovered += 1
                else:
                    print(f"  ⚠️ [{i+1}/{len(corrupted)}] {athlete_name}: No name in API response")
                    failed += 1
            else:
                print(f"  ❌ [{i+1}/{len(corrupted)}] {athlete_name}: API returned None")
                failed += 1

        except Exception as e:
            error_str = str(e)
            if '429' in error_str or 'Rate' in error_str:
                rate_limited += 1
                print(f"  🚫 [{i+1}/{len(corrupted)}] Rate limited - stopping")
                break
            else:
                print(f"  ❌ [{i+1}/{len(corrupted)}] Error: {error_str[:50]}")
                failed += 1

        # Rate limit protection
        time.sleep(0.3)  # 300ms between requests

        # Progress update every 50
        if (i + 1) % 50 == 0:
            print(f"\n📊 Progress: {i+1}/{len(corrupted)} | Recovered: {recovered} | Failed: {failed}\n")

    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ")
    print("=" * 60)
    print(f"  Total traité: {recovered + failed + rate_limited}")
    print(f"  ✅ Récupérés: {recovered}")
    print(f"  ❌ Échecs: {failed}")
    print(f"  🚫 Rate limited: {rate_limited}")

    if rate_limited > 0:
        print("\n⚠️ Rate limit atteint. Relancez le script plus tard.")

    return recovered, failed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Récupère les noms d'activités depuis Nolio")
    parser.add_argument('--dry-run', action='store_true', help="Ne pas modifier la DB, juste afficher")
    parser.add_argument('--limit', type=int, help="Limiter le nombre d'activités à traiter")

    args = parser.parse_args()

    print("=" * 60)
    print("RÉCUPÉRATION DES NOMS D'ACTIVITÉS")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'PRODUCTION'}")
    print("=" * 60)
    print()

    recover_activity_names(dry_run=args.dry_run, limit=args.limit)
