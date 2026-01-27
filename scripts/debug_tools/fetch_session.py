import argparse
import json
import os
import sys
import re

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from projectk_core.integrations.nolio import NolioClient

def sanitize_filename(name):
    return re.sub(r'[^\w\-]', '_', name)

def main():
    parser = argparse.ArgumentParser(description="Fetch Nolio Session JSON + FIT for debugging.")
    parser.add_argument("--athlete", required=True, help="Athlete Name (partial match)")
    parser.add_argument("--date", required=True, help="Date YYYY-MM-DD")
    parser.add_argument("--session", required=False, help="Session Name (partial match)")
    args = parser.parse_args()

    client = NolioClient()
    
    # 1. Find Athlete
    print(f"🔍 Searching for athlete matching '{args.athlete}'...")
    athletes = client.get_managed_athletes()
    matches = [a for a in athletes if args.athlete.lower() in a['name'].lower()]
    
    if not matches:
        print(f"❌ No athlete found matching '{args.athlete}'")
        return
    if len(matches) > 1:
        print(f"⚠️ Multiple athletes found: {[a['name'] for a in matches]}. Using first: {matches[0]['name']}")
    
    athlete = matches[0]
    athlete_id = athlete['nolio_id']
    print(f"✅ Selected Athlete: {athlete['name']} (ID: {athlete_id})")

    # 2. Find Activity
    print(f"🔍 Searching for activities on {args.date}...")
    activities = client.get_activities(athlete_id, args.date, args.date)
    
    if not activities:
        print(f"❌ No activities found on {args.date}")
        return

    target_activity = None
    if args.session:
        # Filter by name
        name_matches = [act for act in activities if args.session.lower() in act.get('name', '').lower()]
        if not name_matches:
            print(f"❌ No activity matching '{args.session}' found on {args.date}. Found: {[act.get('name') for act in activities]}")
            return
        target_activity = name_matches[0]
    else:
        # Default to first if only one, or ask?
        if len(activities) > 1:
            print(f"⚠️ Multiple activities found on {args.date}:")
            for i, act in enumerate(activities):
                print(f"  {i+1}. {act.get('name')}")
            print("Please specify --session to choose one.")
            return
        target_activity = activities[0]

    print(f"✅ Selected Activity: {target_activity.get('name')} (ID: {target_activity.get('nolio_id')})")

    # 3. Fetch Full Details
    print("📥 Fetching full details (JSON)...")
    full_details = client.get_activity_details(target_activity.get('nolio_id'), athlete_id)
    
    # 3.b Check for structure, if missing try to find Planned Workout
    if not full_details.get('structured_workout'):
        print("⚠️ 'structured_workout' missing in Activity details. Searching for Plan...")
        
        # Try to find by date and fuzzy name
        plan = client.find_planned_workout(athlete_id, args.date, title_filter=target_activity.get('name'))
        
        if plan:
            print(f"✅ Found Linked Plan: {plan.get('name')} (ID: {plan.get('nolio_id')})")
            # Fetch full plan details (sometimes structure is deep)
            full_plan = client.get_planned_workout(plan.get('nolio_id'), athlete_id=athlete_id)
            
            full_struct = full_plan.get('structure') or full_plan.get('structured_workout')
            if full_struct:
                 print("✅ Plan has structure! Injecting into activity details for debug.")
                 full_details['structured_workout'] = full_struct
                 # Also save separate plan file just in case
                 # Define base_path early for this block
                 safe_name = sanitize_filename(target_activity.get('name', 'unknown'))
                 base_path_debug = f"data/samples/debug_{sanitize_filename(athlete['name'])}_{args.date}_{safe_name}"
                 
                 plan_path = f"{base_path_debug}_PLAN.json"
                 with open(plan_path, 'w') as f:
                     json.dump(full_plan, f, indent=2)
            else:
                print(f"❌ Found plan but it has no structure either. Keys: {list(full_plan.keys()) if full_plan else 'None'}")
        else:
            print("❌ Could not find corresponding Planned Workout.")

    # 4. Save JSON
    safe_name = sanitize_filename(target_activity.get('name', 'unknown'))
    base_path = f"data/samples/debug_{sanitize_filename(athlete['name'])}_{args.date}_{safe_name}"
    json_path = f"{base_path}.json"
    
    with open(json_path, 'w') as f:
        json.dump(full_details, f, indent=2)
    print(f"💾 Saved JSON to: {json_path}")

    # 5. Download FIT
    # Note: 'file_url' is usually in the root of the details or inside 'files'?
    # Checking typical structure from previous experience: details usually has 'file_url' or similar.
    # Let's inspect the keys if we can't find it.
    fit_url = full_details.get('file_url')
    if not fit_url:
        print("⚠️ No 'file_url' found in activity details. Checking for 'original_file_url'...")
        fit_url = full_details.get('original_file_url')
    
    if fit_url:
        print(f"⬇️ Downloading FIT file from {fit_url[:50]}...")
        fit_data = client.download_fit_file(fit_url)
        if fit_data:
            fit_path = f"{base_path}.fit"
            with open(fit_path, 'wb') as f:
                f.write(fit_data)
            print(f"💾 Saved FIT to: {fit_path}")
        else:
            print("❌ Failed to download FIT file.")
    else:
        print("❌ No FIT URL found in activity details.")

if __name__ == "__main__":
    main()
