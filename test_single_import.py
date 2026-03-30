import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.nolio import NolioClient
from scripts.run_ingest import IngestionRobot

def test_single():
    robot = IngestionRobot()
    athlete_uuid = "837286de-3d2f-4c15-97a2-c6272775dc56" # Estelle
    nolio_id = 1824
    workout_id = "90085299"
    
    print(f"Fetching workout {workout_id}...")
    act = robot.nolio.get_activity_details(workout_id, athlete_id=nolio_id)
    if not act:
        print("Workout not found on Nolio")
        return
        
    print(f"Ingesting workout {workout_id}...")
    # I'll call process_activity but I want to see the errors
    try:
        robot.process_activity(athlete_uuid, act, athlete_nolio_id=nolio_id)
        print("Done process_activity")
    except Exception as e:
        print(f"Error in process_activity: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_single()
