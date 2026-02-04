from typing import Optional
from tqdm import tqdm
import pandas as pd
import tempfile
import logging
import os
from datetime import datetime

# Setup logging
log = logging.getLogger(__name__)

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.integrations.nolio import NolioClient
from projectk_core.integrations.weather import WeatherClient
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.processing.plan_parser import NolioPlanParser, TextPlanParser
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
    def __init__(self, offline_mode: bool = False):
        self.db = DBConnector()
        self.storage = StorageManager()
        self.nolio = NolioClient()
        self.weather = WeatherClient()
        self.config = AthleteConfig()
        self.calculator = MetricsCalculator(self.config)
        self.profile_manager = ProfileManager(self.db)
        self.classifier = ActivityClassifier()
        self.interval_detector = IntervalDetector()
        self.nolio_plan_parser = NolioPlanParser()
        self.text_plan_parser = TextPlanParser()
        self.offline_mode = offline_mode

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
        # Include activity_name to preserve it if API fails
        acts = self.db.client.table("activities")\
            .select("id, nolio_id, fit_file_path, sport_type, session_date, rpe, activity_name")\
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
            # 3. Parse
            log.info(f"   🔄 Parsing file (Universal)...")
            df, device_meta, laps = UniversalParser.parse(tmp_path)
            
            # 4. Get Correct Physio Profile for THAT date
            start_time = datetime.fromisoformat(act_record['session_date'])
            sport = act_record['sport_type']
            
            # Get Plan from Nolio
            nolio_id = act_record.get('nolio_id')
            plan = None
            activity_title = ""

            # ===== PRESERVE EXISTING DATA (2026-02-04) =====
            # If Nolio API fails (rate limiting, etc.), use existing activity_name from DB
            existing_activity_name = act_record.get('activity_name') or ""

            if nolio_id and not self.offline_mode:
                details = None
                try:
                    details = self.nolio.get_activity_details(int(nolio_id), athlete_id=athlete_nolio_id)
                except Exception as e:
                    print(f"      [dim]⚠️ Nolio API skipped (Rate Limit/Error): {e}[/dim]")
                
                if details:
                    activity_title = details.get('planned_name') or details.get('name') or ""
                    
                    # Strategy A: Structured Workout from Activity Details (if synced)
                    # or from Linked Planned Workout
                    structure_source = details.get('structured_workout')
                    
                    if not structure_source and details.get('planned_id'):
                         planned = self.nolio.get_planned_workout(int(details['planned_id']), athlete_id=athlete_nolio_id)
                         if planned:
                             structure_source = planned.get('structured_workout') or planned.get('structure')
                             # Also try to parse text title of planned workout if no structure
                             if not structure_source:
                                 planned_title = planned.get('name', '')
                                 plan = self.text_plan_parser.parse(planned_title)
                    
                    if structure_source:
                        # merge_adjacent_work=True fusionne les blocs Z3+Z2 adjacents (système Karoly)
                        plan = self.nolio_plan_parser.parse(
                            structure_source,
                            sport_type=sport,
                            merge_adjacent_work=True
                        )
                        print(f"      [bold green]💎 Deep Plan Found:[/bold green] {len(plan)} intervals detected from JSON.")
                    elif not plan and activity_title:
                        # Strategy B: Text Parsing
                        plan = self.text_plan_parser.parse(activity_title)
                        if plan:
                             print(f"      [bold cyan]📝 Text Plan Parsed:[/bold cyan] {len(plan)} intervals from '{activity_title}'")
            else:
                # API disabled (offline mode) or failed or returned None - use existing name from database
                activity_title = existing_activity_name
                # Try to parse text plan from existing title
                plan = self.text_plan_parser.parse(activity_title)
                if plan:
                    print(f"      [bold cyan]📝 Text Plan Parsed (Fallback/Offline):[/bold cyan] {len(plan)} intervals from '{activity_title}'")

            if plan:
                if isinstance(plan, list):
                    print(f"      [bold green]📋 Strategy: Guided Detection[/bold green] -> {len(plan)} Intervals Targeted")
                else:
                    print(f"      [bold green]📋 Strategy: Guided Detection[/bold green] -> {plan.get('reps', '?')}x{plan.get('duration', '?')}")

            # Detect Work Type
            work_type = self.classifier.detect_work_type(df, activity_title, "") 
            print(f"      Detected Work Type: [bold cyan]{work_type}[/bold cyan]")

            interval_metrics = {}
            if work_type == "intervals":
                if plan:
                    # Guided Detection - include laps for LAP-based matching and HR filtering
                    interval_metrics = self.interval_detector.detect(Activity(metadata=None, streams=df, laps=laps), plan)
                else:
                    # Stage 3: Blind Detection Fallback
                    print("      [dim]No plan found on Nolio, using Blind Autostruct...[/dim]")
                    interval_metrics = self.interval_detector.detect(Activity(metadata=None, streams=df, laps=laps), None)
                
                if interval_metrics:
                    print(f"      [bold yellow]⚡ Intervals Detected:[/bold yellow]")
                    # Power metrics
                    p_last = interval_metrics.get('interval_power_last')
                    p_mean = interval_metrics.get('interval_power_mean')
                    if p_last or p_mean:
                        print(f"         • P Last: [green]{p_last}W[/green] | Mean: [green]{p_mean}W[/green]")

                    # HR metrics
                    hr_last = interval_metrics.get('interval_hr_last')
                    hr_mean = interval_metrics.get('interval_hr_mean')
                    if hr_last or hr_mean:
                        print(f"         • HR Last: [red]{hr_last}bpm[/red] | Mean: [red]{hr_mean}bpm[/red]")

                    # Speed/Pace metrics (new)
                    pace_last = interval_metrics.get('interval_pace_last')
                    pace_mean = interval_metrics.get('interval_pace_mean')
                    if pace_last or pace_mean:
                        # Format pace from decimal (4.5) to string (4'30'')
                        def fmt_pace(p):
                            if p is None: return 'N/A'
                            mins = int(p)
                            secs = int((p - mins) * 60)
                            return f"{mins}'{secs:02d}''"
                        print(f"         • Pace Last: [cyan]{fmt_pace(pace_last)}/km[/cyan] | Mean: [cyan]{fmt_pace(pace_mean)}/km[/cyan]")

                    # Session completion (new)
                    if 'session_complete' in interval_metrics:
                        matched = interval_metrics.get('session_matched_intervals', 0)
                        expected = interval_metrics.get('session_expected_intervals', 0)
                        ratio = interval_metrics.get('session_completion_ratio', 0) * 100
                        status = "✅ Complète" if interval_metrics['session_complete'] else "⚠️ Incomplète"
                        print(f"         • Session: {status} ({matched}/{expected} = {ratio:.0f}%)")

                    # Print breakdown
                    for i, block in enumerate(interval_metrics.get('blocks', [])):
                        p = block.get('avg_power')
                        hr = block.get('avg_hr')
                        spd = block.get('avg_speed')
                        dur = block.get('duration_sec')
                        parts = []
                        if p: parts.append(f"{p}W")
                        if hr: parts.append(f"{hr}bpm")
                        if spd: parts.append(f"{spd:.2f}m/s")
                        print(f"         [dim]Block {i+1}: {' | '.join(parts)} ({dur}s)[/dim]")

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
            elif work_type == "intervals" and interval_metrics:
                # ===== FIX 2026-02-04: Save interval metrics even without profile =====
                # Athletes without profiles can still have valid interval metrics
                # BUT only if completion threshold is met (70%)
                matched = interval_metrics.get('session_matched_intervals', 0)
                expected = interval_metrics.get('session_expected_intervals', 1)
                completion = matched / expected if expected > 0 else 0

                if completion >= 0.70:
                    print(f"      ⚠️ No profile found, but saving interval metrics ({matched}/{expected} = {completion*100:.0f}%)")
                    activity.metrics = ActivityMetrics(**interval_metrics)
                else:
                    print(f"      ⚠️ No profile + incomplete session ({matched}/{expected} = {completion*100:.0f}% < 70%) -> NULL")
                    # Don't save incomplete interval metrics
                
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