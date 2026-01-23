import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    # Fetching activities with ratio missing in phases or segmented_metrics null
    res = supabase.table("activities").select("id, athlete_id, activity_name, session_date, avg_hr, segmented_metrics, work_type, source_sport").not_.is_("avg_hr", "null").order("session_date", desc=True).limit(30).execute()
    
    activities = res.data
    
    for a in activities:
        sm = a.get('segmented_metrics')
        decouplage_null = False
        reason = ""
        
        if not sm:
            decouplage_null = True
            reason = "segmented_metrics is NULL"
        elif 'splits_2' not in sm:
            decouplage_null = True
            reason = "splits_2 missing"
        elif 'phase_1' not in sm['splits_2'] or 'phase_2' not in sm['splits_2']:
            decouplage_null = True
            reason = "phases missing in splits_2"
        else:
            p1 = sm['splits_2']['phase_1'].get('ratio')
            p2 = sm['splits_2']['phase_2'].get('ratio')
            if p1 is None or p2 is None:
                decouplage_null = True
                reason = "ratio missing in phases"
        
        if decouplage_null:
            ath_res = supabase.table("athletes").select("first_name, last_name").eq("id", a['athlete_id']).execute()
            ath_name = f"{ath_res.data[0]['first_name']} {ath_res.data[0]['last_name']}" if ath_res.data else "Unknown"
            
            print(f"Athlete: {ath_name}")
            print(f"Activity: {a['activity_name']} ({a['source_sport']}) - {a['session_date']}")
            print(f"Reason: {reason}")
            print(f"Work Type: {a['work_type']}")
            if sm:
                # Print only relevant parts of sm to save tokens
                small_sm = {k: v for k, v in sm.items() if k in ['splits_2', 'error', 'status']}
                print(f"SM Extract: {json.dumps(small_sm, indent=2)}")
            print("-" * 40)

except Exception as e:
    print(f"Error: {e}")
