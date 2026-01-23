import os
import sys
from tqdm import tqdm
from projectk_core.db.connector import DBConnector

def fix_mls_sports():
    """
    Cleans up the activities table by nullifying load_index for non-Running/Cycling activities.
    This follows the restriction that MLS is only for Run and Bike.
    """
    print("Connecting to database...")
    db = DBConnector()
    
    # 1. Fetch all activities with load_index NOT NULL
    print("Fetching activities with existing load_index...")
    res = db.client.table('activities').select('id, sport_type, activity_name, load_index').not_.is_('load_index', 'null').execute()
    
    activities = res.data
    print(f"Found {len(activities)} activities with load_index.")
    
    to_nullify = []
    
    for act in activities:
        sport = act.get('sport_type', 'Other')
        name = (act.get('activity_name') or '').lower()
        
        is_run = sport == 'Run'
        is_bike = sport == 'Bike'
        
        # Restriction logic (matches calculator.py)
        is_eligible = False
        if is_bike:
            is_eligible = True
        elif is_run:
            # Exclude non-running activities that might be in the 'Run' category
            if not any(x in name for x in ["hiking", "randonnée", "ski", "rando"]):
                is_eligible = True
        
        if not is_eligible:
            to_nullify.append(act['id'])
            
    print(f"Planning to nullify load_index for {len(to_nullify)} activities.")
    
    if not to_nullify:
        print("Nothing to do.")
        return

    # Update in batches to avoid timeouts or large requests
    batch_size = 50
    for i in tqdm(range(0, len(to_nullify), batch_size)):
        batch_ids = to_nullify[i:i + batch_size]
        # In Supabase/Postgrest, we can't easily do WHERE id IN (...) for UPDATE via the python client in one go for multiple specific values?
        # Actually, we can use .in_('id', batch_ids)
        db.client.table('activities').update({'load_index': None}).in_('id', batch_ids).execute()

    print(f"Successfully nullified {len(to_nullify)} records.")

if __name__ == "__main__":
    fix_mls_sports()
