from typing import Optional
from tqdm import tqdm
import pandas as pd
import tempfile
import os
from datetime import datetime

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.models import Activity, ActivityMetadata, ActivityMetrics
from projectk_core.db.writer import ActivityWriter

class ReprocessingEngine:
    """
    Engine to re-calculate metrics for existing activities in the database.
    Does NOT call Nolio API. Uses stored FIT files.
    """
    def __init__(self):
        self.db = DBConnector()
        self.storage = StorageManager()
        self.config = AthleteConfig()
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)

    def run(self, athlete_name_filter: Optional[str] = None, force: bool = False):
        print(f"Starting Reprocessing Engine...")
        
        # 1. Select Athletes
        query = self.db.client.table("athletes").select("id, first_name, last_name")
        if athlete_name_filter:
            query = query.ilike("first_name", f"%{athlete_name_filter}%")
        
        athletes = query.execute().data
        print(f"Found {len(athletes)} athletes to process.")

        for athlete in athletes:
            self.process_athlete(athlete, force)

    def process_athlete(self, athlete, force):
        athlete_id = athlete['id']
        full_name = f"{athlete['first_name']} {athlete['last_name']}"
        print(f"\nProcessing: {full_name}")

        # 2. Fetch Activities
        # Only fetch those with a fit_file_path (can't reprocess metadata-only ones efficiently yet)
        acts = self.db.client.table("activities")\
            .select("id, nolio_id, fit_file_path, sport_type, session_date, rpe")\
            .eq("athlete_id", athlete_id)\
            .not_.is_("fit_file_path", "null")\
            .execute().data
            
        if not acts:
            print("   No activities with files found.")
            return

        print(f"   Found {len(acts)} activities with files.")

        for act in tqdm(acts, desc=f"   Reprocessing {athlete['first_name']}", leave=False):
            try:
                self.recalculate_activity(athlete_id, act)
            except Exception as e:
                print(f"   \u274c Error on {act.get('nolio_id')}: {e}")

    def recalculate_activity(self, athlete_id, act_record):
        # 3. Download FIT
        path = act_record.get('fit_file_path')
        if not path:
            return

        fit_data = self.storage.download_fit_file(path)
        if not fit_data:
            print(f"      \u26a0\ufe0f File not found in storage: {path}")
            return

        # 4. Parse
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name
        
        try:
            df, device_meta, laps = FitParser.parse(tmp_path)
            
            # 5. Re-Calculate
            # Use data from record or re-parse?
            # We trust the DB sport_type and date usually, but re-parsing ensures consistency with new logic.
            
            # Construct Metadata from DB record to preserve manual edits?
            # Ideally, we keep RPE from DB if it was edited.
            # But here we are re-calculating from raw file.
            
            # Let's trust the DB for 'Truth' metadata like RPE
            start_time = datetime.fromisoformat(act_record['session_date'])
            sport = act_record['sport_type']
            
            meta = ActivityMetadata(
                activity_type=sport,
                start_time=start_time,
                duration_sec=len(df),
                rpe=act_record.get('rpe')
            )
            
            activity = Activity(metadata=meta, streams=df, laps=laps)
            
            # Fetch Profile
            profile = self.profile_manager.get_profile_for_date(athlete_id, sport, start_time)
            
            if profile and not df.empty:
                metrics_dict = self.calculator.compute(activity, profile)
                activity.metrics = ActivityMetrics(**metrics_dict)
                
                # 6. Update DB
                # specific update to avoid overwriting Nolio IDs or Hashes if they are static
                ActivityWriter.save(
                    activity, 
                    self.db, 
                    athlete_id, 
                    nolio_id=act_record['nolio_id'], 
                    file_hash=None, # Don't change hash
                    file_path=path
                )
            
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
