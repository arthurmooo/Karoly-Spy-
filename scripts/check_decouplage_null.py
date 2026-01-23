import os
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

# Query view_live_flux but it might be easier to query activities directly to see the raw data
# We want to find sessions where:
# a.segmented_metrics->'splits_2'->'phase_2'->>'ratio' is NULL 
# OR a.segmented_metrics->'splits_2'->'phase_1'->>'ratio' is NULL
# WHILE avg_hr is NOT NULL

query = """
SELECT 
    a.id,
    ath.first_name || ' ' || ath.last_name AS athlete,
    a.activity_name,
    a.session_date,
    a.avg_hr,
    a.segmented_metrics
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
WHERE a.avg_hr IS NOT NULL
AND (
    a.segmented_metrics IS NULL 
    OR a.segmented_metrics->'splits_2' IS NULL
    OR a.segmented_metrics->'splits_2'->'phase_1' IS NULL
    OR a.segmented_metrics->'splits_2'->'phase_2' IS NULL
)
ORDER BY a.session_date DESC
LIMIT 10;
"""

# Since I can't run raw SQL easily via the python client without a function, 
# I will query the table directly using filters if possible, 
# or just fetch recent activities and check in Python.

try:
    # Fetching last 50 activities with avg_hr not null
    res = supabase.table("activities").select("id, athlete_id, activity_name, session_date, avg_hr, segmented_metrics, work_type").not_.is_("avg_hr", "null").order("session_date", desc=True).limit(50).execute()
    
    activities = res.data
    
    print(f"{'Date':<20} | {'Athlete':<15} | {'Activity':<30} | {'Decouplage Status'}")
    print("-" * 80)
    
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
            # Get athlete name
            ath_res = supabase.table("athletes").select("first_name, last_name").eq("id", a['athlete_id']).execute()
            ath_name = f"{ath_res.data[0]['first_name']} {ath_res.data[0]['last_name']}" if ath_res.data else "Unknown"
            
            print(f"{a['session_date'][:19]:<20} | {ath_name:<15} | {a['activity_name'][:30]:<30} | {reason}")
            # print(f"Work Type: {a['work_type']}")
            # print(f"SM: {json.dumps(sm, indent=2) if sm else 'None'}")
            # print("-" * 80)

except Exception as e:
    print(f"Error: {e}")
