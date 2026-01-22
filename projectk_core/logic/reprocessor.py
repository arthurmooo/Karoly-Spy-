from typing import Optional
from tqdm import tqdm
import pandas as pd
import tempfile
import os
from datetime import datetime

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.integrations.nolio import NolioClient
from projectk_core.integrations.weather import WeatherClient
from projectk_core.processing.parser import FitParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.models import Activity, ActivityMetadata, ActivityMetrics
from projectk_core.db.writer import ActivityWriter
from projectk_core.logic.classifier import ActivityClassifier
from projectk_core.logic.interval_detector import IntervalDetector

class ReprocessingEngine:
    """
    Engine to re-calculate metrics for existing activities in the database.
    Does NOT call Nolio API. Uses stored FIT files.
    """
    def __init__(self):
        self.db = DBConnector()
        self.storage = StorageManager()
        self.nolio = NolioClient()
        self.weather = WeatherClient()
        self.config = AthleteConfig()
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)
        self.classifier = ActivityClassifier()
        self.interval_detector = IntervalDetector()

    def run(self, athlete_name_filter: Optional[str] = None, force: bool = False):
        print(f"Starting Reprocessing Engine...")
        
        # 1. Select Athletes
        query = self.db.client.table("athletes").select("id, first_name, last_name, nolio_id")
        if athlete_name_filter:
            query = query.ilike("first_name", f"%{athlete_name_filter}%")
        
        athletes = query.execute().data
        print(f"Found {len(athletes)} athletes to process.")

        for athlete in athletes:
            self.process_athlete(athlete, force)

    def process_athlete(self, athlete, force):
        athlete_id = athlete['id']
        athlete_nolio_id = athlete.get('nolio_id')
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
                self.recalculate_activity(athlete_id, act, athlete_nolio_id=athlete_nolio_id)
            except Exception as e:
                print(f"   ❌ Error on {act.get('nolio_id')}: {e}")

    def recalculate_activity(self, athlete_id, act_record, athlete_nolio_id=None):
        # 3. Download FIT
        path = act_record.get('fit_file_path')
        if not path:
            return

        fit_data = self.storage.download_fit_file(path)
        if not fit_data:
            print(f"      ⚠️ File not found in storage: {path}")
            return

        # 4. Parse
        with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
            tmp.write(fit_data)
            tmp_path = tmp.name
        
        try:
            df, device_meta, laps = FitParser.parse(tmp_path)
            
            # 5. Re-Calculate
            start_time = datetime.fromisoformat(act_record['session_date'])
            sport = act_record['sport_type']
            
            # Get Plan from Nolio
            nolio_id = act_record.get('nolio_id')
            plan = None
            activity_title = ""
            
            if nolio_id:
                details = self.nolio.get_activity_details(int(nolio_id), athlete_id=athlete_nolio_id)
                if details:
                    # Stage 1: Try Title Parsing
                    activity_title = details.get('planned_name') or details.get('name') or ""
                    plan = NolioPlanParser.parse(activity_title)
                    
                    # Stage 2: Deep JSON Parsing (if title parsing failed)
                    if not plan and details.get('planned_id'):
                        planned_details = self.nolio.get_planned_workout(int(details['planned_id']), athlete_id=athlete_nolio_id)
                        plan = NolioPlanParser.parse_json_structure(planned_details)
                        if plan:
                            print(f"      [bold green]💎 Deep Plan Found:[/bold green] {plan['reps']}x{plan['duration']}s detected from JSON.")

            if plan:
                print(f"      [bold green]📋 Strategy: Guided Detection[/bold green] -> {plan['reps']}x{plan['duration']}{plan['unit']}")

            # Detect Work Type
            work_type = self.classifier.detect_work_type(df, activity_title, "") 
            print(f"      Detected Work Type: [bold cyan]{work_type}[/bold cyan]")

            interval_metrics = {}
            if work_type == "intervals":
                if plan:
                    # Guided Detection
                    interval_metrics = self.interval_detector.detect(Activity(metadata=None, streams=df), plan)
                else:
                    # Stage 3: Blind Detection Fallback
                    print("      [dim]No plan found on Nolio, using Blind Autostruct...[/dim]")
                    interval_metrics = self.interval_detector.detect(Activity(metadata=None, streams=df), None)
                
                if interval_metrics:
                    print(f"      [bold yellow]⚡ Intervals Detected:[/bold yellow]")
                    print(f"         • P Last: [green]{interval_metrics.get('interval_power_last')}W[/green] | Mean: [green]{interval_metrics.get('interval_power_mean')}W[/green]")
                    print(f"         • HR Last: [red]{interval_metrics.get('interval_hr_last')}bpm[/red] | Mean: [red]{interval_metrics.get('interval_hr_mean')}bpm[/red]")
                    
                    # Print breakdown
                    for i, block in enumerate(interval_metrics.get('blocks', [])):
                        print(f"         [dim]Block {i+1}: {block['avg_power']}W | {block['avg_hr']}bpm ({block['duration_sec']}s)[/dim]")

            meta = ActivityMetadata(
                activity_type=sport,
                activity_name=activity_title,
                start_time=start_time,
                duration_sec=len(df),
                rpe=act_record.get('rpe'),
                work_type=work_type
            )
            
            # Fetch Weather (API)
            if not df.empty and 'lat' in df.columns and 'lon' in df.columns:
                valid_coords = df[['lat', 'lon']].dropna().iloc[:1]
                if not valid_coords.empty:
                    lat, lon = float(valid_coords['lat'].iloc[0]), float(valid_coords['lon'].iloc[0])
                    w = self.weather.get_weather_at_timestamp(lat, lon, start_time)
                    if w:
                        meta.temp_avg = w.get("temp")
                        meta.humidity_avg = w.get("humidity")
                        meta.weather_source = "openweathermap"
                        print(f"      🌍 Weather Found: {meta.temp_avg}°C | {meta.humidity_avg}% Hum.")

            activity = Activity(metadata=meta, streams=df, laps=laps)
            
            # Fetch Profile
            profile = self.profile_manager.get_profile_for_date(athlete_id, sport, start_time)
            
            if profile and not df.empty:
                metrics_dict = self.calculator.compute(activity, profile)
                
                # Merge interval metrics into calculator output (only if work_type is intervals)
                if work_type == "intervals":
                    metrics_dict.update(interval_metrics)
                else:
                    # Security: Remove any stray interval keys from general calculator
                    interval_keys = ["interval_power_last", "interval_hr_last", "interval_power_mean", "interval_hr_mean"]
                    for k in interval_keys:
                        metrics_dict.pop(k, None)
                
                activity.metrics = ActivityMetrics(**metrics_dict)
                
            # 6. Update DB (Always save if we have a file, even without profile)
            ActivityWriter.update_by_id(
                act_record['id'],
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