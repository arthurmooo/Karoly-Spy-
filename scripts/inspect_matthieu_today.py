
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector

def check_activity_classification(nolio_id):
    db = DBConnector()
    # Check activity table
    act_res = db.client.table("activities").select("*").eq("nolio_id", nolio_id).execute()
    
    if not act_res.data:
        print(f"No activity found with Nolio ID {nolio_id}")
        return
        
    activity = act_res.data[0]
    print(f"Activity Details:")
    for key, value in activity.items():
        print(f"{key}: {value}")
    
    # Check activity_intervals table
    int_res = db.client.table("activity_intervals").select("*").eq("activity_id", activity['id']).execute()
    print(f"\nFound {len(int_res.data)} intervals in 'activity_intervals' table.")
    for i, interval in enumerate(int_res.data):
        print(f"Interval {i+1}: Start={interval['start_time']}s, End={interval['end_time']}s, Type={interval['interval_type']}, Label={interval['label']}")

if __name__ == "__main__":
    # Nolio ID for the Run activity today
    check_activity_classification(90187928)
