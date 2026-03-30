"""
One-shot script: fix activities where source_sport contains 'ski'
but sport_type was incorrectly set (e.g. 'Run' instead of 'Ski').
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.logic.sport_mapper import normalize_sport


def fix_ski_sport_type():
    db = DBConnector()

    print("🔍 Fetching activities with 'ski' in source_sport...")
    res = db.client.table("activities") \
        .select("id, nolio_id, source_sport, sport_type") \
        .ilike("source_sport", "%ski%") \
        .execute()

    activities = res.data
    print(f"   Found {len(activities)} activities with 'ski' in source_sport.")

    fixed = 0
    for act in activities:
        correct_sport = normalize_sport(act["source_sport"] or "")
        if correct_sport != act["sport_type"]:
            print(f"   🔄 {act['nolio_id']}: {act['sport_type']} → {correct_sport} (source: {act['source_sport']})")
            db.client.table("activities").update({"sport_type": correct_sport}).eq("id", act["id"]).execute()
            fixed += 1
        else:
            print(f"   ✅ {act['nolio_id']}: already {act['sport_type']} (source: {act['source_sport']})")

    print(f"\n🏁 Done. Fixed {fixed}/{len(activities)} activities.")


if __name__ == "__main__":
    fix_ski_sport_type()
