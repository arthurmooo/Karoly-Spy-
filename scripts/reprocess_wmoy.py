
import os
import sys
import tempfile
import pandas as pd
from tqdm import tqdm
from rich.console import Console
from datetime import datetime, timezone

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.calculator import MetricsCalculator
from projectk_core.logic.profile_manager import ProfileManager
from projectk_core.logic.config_manager import AthleteConfig
from projectk_core.logic.models import Activity, ActivityMetadata, ActivityMetrics
from projectk_core.db.writer import ActivityWriter

console = Console()

def reprocess_wmoy():
    db = DBConnector()
    storage = StorageManager()
    config = AthleteConfig()
    calculator = MetricsCalculator(config)
    profile_manager = ProfileManager(db)
    
    console.print("[bold green]Starting WMoy (Zero-Excluded Power) Reprocessing...[/bold green]")
    console.print("[dim]This script uses stored FIT files and does NOT call Nolio API.[/dim]")

    # 1. Fetch all Bike activities with FIT files
    query = db.client.table("activities")\
        .select("id, nolio_id, athlete_id, fit_file_path, sport_type, session_date, activity_name, source_sport, rpe, source_json")\
        .eq("sport_type", "Bike")\
        .not_.is_("fit_file_path", "null")
    
    res = query.execute()
    activities = res.data
    
    if not activities:
        console.print("[yellow]No bike activities with files found to reprocess.[/yellow]")
        return

    console.print(f"📊 Found [bold cyan]{len(activities)}[/bold cyan] bike activities to update.")

    updates_count = 0
    errors_count = 0

    for act in tqdm(activities, desc="Reprocessing Bike Power"):
        act_id = act['id']
        path = act['fit_file_path']
        athlete_id = act['athlete_id']
        
        try:
            # 2. Download from Storage
            fit_data = storage.download_fit_file(path)
            if not fit_data:
                continue

            # 3. Parse FIT
            with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                tmp.write(fit_data)
                tmp_path = tmp.name
            
            try:
                df, device_meta, laps = UniversalParser.parse(tmp_path)
                if df.empty:
                    continue
                
                # Use session date from DB
                start_time = datetime.fromisoformat(act['session_date'])
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=timezone.utc)

                # 4. Prepare Metadata & Activity object
                meta = ActivityMetadata(
                    activity_type=act['sport_type'],
                    activity_name=act.get('activity_name'),
                    source_sport=act.get('source_sport'),
                    start_time=start_time,
                    duration_sec=float(len(df)),
                    rpe=act.get('rpe'),
                    source_json=act.get('source_json')
                )
                
                # Activity object needs metadata and streams
                activity_obj = Activity(metadata=meta, streams=df, laps=laps)
                
                # 5. Fetch Profile & Re-calculate
                profile = profile_manager.get_profile_for_date(athlete_id, act['sport_type'], start_time)
                
                # Compute (this will use the new zero-excluding logic)
                metrics_dict = calculator.compute(activity_obj, profile)
                
                # For safety, if it was intervals, we'd need to re-detect to get interval_power_mean right
                # But since we updated calculator.compute and writer.serialize, 
                # we primarily want the avg_power and the internal metrics.
                
                activity_obj.metrics = ActivityMetrics(**metrics_dict)
                
                # 6. Update DB
                # ActivityWriter.serialize will now use the new avg_power logic (no zeros)
                ActivityWriter.update_by_id(
                    act_id,
                    activity_obj,
                    db,
                    athlete_id,
                    nolio_id=act['nolio_id'],
                    file_path=path
                )
                updates_count += 1
                
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    
        except Exception as e:
            errors_count += 1
            # Quietly log error to console without breaking tqdm
            # console.print(f"[red]Error on {act['nolio_id']}: {e}[/red]")

    console.print(f"\n[bold green]✅ Reprocessing Complete![/bold green]")
    console.print(f"   • Updated: [bold]{updates_count}[/bold]")
    console.print(f"   • Errors: [bold red]{errors_count}[/bold red]")

if __name__ == "__main__":
    reprocess_wmoy()
