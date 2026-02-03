
import os
import sys
import tempfile
import pandas as pd
from datetime import datetime, timedelta, timezone
from rich.console import Console
from rich.table import Table

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.logic.interval_engine import IntervalEngine
from projectk_core.logic.interval_auditor import IntervalAuditor

console = Console()

def format_pace(speed_ms):
    if not speed_ms or speed_ms <= 0: return "0:00"
    pace_seconds = 1000 / speed_ms
    minutes = int(pace_seconds // 60)
    seconds = int(pace_seconds % 60)
    return f"{minutes}:{seconds:02d}"

def get_detail(nolio_id, a_nolio_id, display_name):
    db = DBConnector()
    storage = StorageManager()
    nolio = NolioClient()
    
    act_record = db.client.table("activities").select("*").eq("nolio_id", nolio_id).execute().data[0]
    path = act_record['fit_file_path']
    fit_data = storage.download_fit_file(path)
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    try:
        df, meta, laps = UniversalParser.parse(tmp_path)
        if 'timestamp' in df.columns: df = df.set_index('timestamp')
        
        start_time = pd.to_datetime(act_record['session_date'], utc=True)
        sport = act_record['sport_type']
        
        # Strategy A
        plan = None
        details = nolio.get_activity_details(nolio_id, athlete_id=a_nolio_id)
        if details:
            structure_source = details.get('structured_workout')
            if not structure_source and details.get('planned_id'):
                planned = nolio.get_planned_workout(int(details['planned_id']), athlete_id=a_nolio_id)
                if planned:
                    structure_source = planned.get('structured_workout') or planned.get('structure')
            if structure_source:
                plan = NolioPlanParser().parse(structure_source, sport_type=sport)
        
        engine = IntervalEngine(plan=plan, raw_laps=laps, streams=df.reset_index(), workout_start_time=start_time)
        blocks = engine.process()
        
        # Filter active only
        active_blocks = [b for b in blocks if b.type == "active"]
        
        table = Table(title=f"Détail Session : {display_name} ({sport})")
        table.add_column("Tour", justify="right")
        table.add_column("Durée", justify="right")
        table.add_column("Distance (m)", justify="right")
        table.add_column("FC Moy (BPM)", justify="right")
        table.add_column("Allure (min/km)", justify="right")
        
        for i, b in enumerate(active_blocks):
            table.add_row(
                str(i+1),
                f"{int(b.duration)}s",
                f"{b.distance_m:.0f}" if b.distance_m else "-",
                f"{b.avg_hr:.0f}" if b.avg_hr else "-",
                format_pace(b.avg_speed)
            )
        console.print(table)
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    sessions = [
        (90341231, 57896, "Adrien HIT 15-45"),
        (90370443, 138748, "Matthieu 20*200m"),
        (90342370, 138748, "Matthieu 5*(1'+4')")
    ]
    for nid, aid, name in sessions:
        get_detail(nid, aid, name)
