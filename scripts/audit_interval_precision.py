import argparse
import sys
import os
import tempfile
from datetime import datetime, timedelta, timezone
import pandas as pd
from rich.console import Console
from rich.table import Table

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.logic.interval_auditor import IntervalAuditor

console = Console()

def main():
    parser = argparse.ArgumentParser(description="Audit Interval Detection Precision")
    parser.add_argument("--athlete", type=str, help="Filter by athlete name")
    parser.add_argument("--date", type=str, help="Filter by date (YYYY-MM-DD)")
    parser.add_argument("--limit", type=int, default=5, help="Max number of activities to audit")
    
    args = parser.parse_args()
    
    db = DBConnector()
    storage = StorageManager()
    
    # Build Query
    query = db.client.table("activities").select("*").order("session_date", desc=True)
    
    # Fetch list of athletes to match name to ID
    try:
        athletes = db.client.table("athletes").select("id, first_name, last_name").execute().data
        athlete_map = {a['id']: f"{a['first_name']} {a['last_name']}" for a in athletes}
    except Exception as e:
        console.print(f"[red]Failed to fetch athletes: {e}[/red]")
        return
    
    if args.athlete:
        # Find ID
        target_ids = [k for k, v in athlete_map.items() if args.athlete.lower() in v.lower()]
        if not target_ids:
            console.print(f"[red]Athlete '{args.athlete}' not found.[/red]")
            return
        query = query.in_("athlete_id", target_ids)
        
    if args.date:
        query = query.gte("session_date", f"{args.date}T00:00:00").lte("session_date", f"{args.date}T23:59:59")

    try:
        results = query.limit(args.limit).execute().data
    except Exception as e:
        console.print(f"[red]Failed to fetch activities: {e}[/red]")
        return
    
    if not results:
        console.print("[yellow]No activities found matching criteria.[/yellow]")
        return
        
    console.print(f"[green]Found {len(results)} activities. Starting Audit...[/green]")
    
    for act_data in results:
        process_activity(act_data, storage, athlete_map)

def process_activity(act_data, storage, athlete_map):
    name = act_data.get('activity_name', 'Unknown')
    sport = act_data.get('sport_type', 'Unknown')
    athlete_name = athlete_map.get(act_data.get('athlete_id'), 'Unknown')
    date = act_data.get('session_date')
    
    console.print(f"\n[bold blue]--- Activity: {name} ---[/bold blue]")
    console.print(f"Athlete: {athlete_name} | Date: {date} | Sport: {sport}")
    
    path = act_data.get('fit_file_path')
    if not path:
        console.print("[red]No FIT file path.[/red]")
        return

    try:
        fit_data = storage.download_fit_file(path)
    except Exception as e:
        console.print(f"[red]Failed to download FIT: {e}[/red]")
        return
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    try:
        # Parse
        df, meta, laps = UniversalParser.parse(tmp_path)
        
        # Ensure DF has datetime index
        if 'timestamp' in df.columns:
            df = df.set_index('timestamp')
        
        if not laps:
            console.print("[yellow]No Laps found in FIT file.[/yellow]")
            return
            
        # Prepare Laps for Auditor
        intervals = []
        for i, lap in enumerate(laps):
            start = lap.get('start_time')
            if not start:
                continue
                
            # Ensure UTC timezone awareness to match DF
            if isinstance(start, str):
                start = pd.to_datetime(start, utc=True)
            elif isinstance(start, datetime):
                 if start.tzinfo is None:
                     start = start.replace(tzinfo=timezone.utc)
            
            # Duration
            dur = lap.get('total_elapsed_time')
            if not dur:
                dur = lap.get('total_timer_time', 0)
                
            if not dur:
                continue
                
            end = start + timedelta(seconds=dur)
            
            intervals.append({
                "start_time": start,
                "end_time": end
            })
            
        # Create Activity Object Wrapper
        class MockActivity:
            def __init__(self, df, sport):
                self.df = df
                self.sport = sport
        
        mock_act = MockActivity(df, sport)
        
        # Run Auditor
        auditor = IntervalAuditor(mock_act)
        report = auditor.audit(intervals)
        
        # Print Table
        table = Table(title=f"Interval Audit ({len(report)} laps)")
        table.add_column("#", justify="right")
        table.add_column("Dur", justify="right")
        table.add_column("HR", justify="right")
        
        if "Running" in sport or "Trail" in sport:
            table.add_column("Speed (km/h)", justify="right")
        else:
            table.add_column("Power (W)", justify="right")
            
        table.add_column("Data Pts", justify="right")

        for row in report:
            idx = str(row['interval_index'] + 1)
            dur = f"{row['duration_sec']:.0f}s"
            hr = f"{row.get('avg_hr', 0):.0f}"
            pts = str(row['data_points'])
            
            if "Running" in sport or "Trail" in sport:
                spd = row.get('avg_speed', 0) * 3.6 # m/s to km/h
                perf = f"{spd:.1f}"
            else:
                pwr = row.get('avg_power', 0)
                perf = f"{pwr:.0f}"
            
            table.add_row(idx, dur, hr, perf, pts)
            
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]Error processing activity: {e}[/red]")
        # import traceback
        # traceback.print_exc()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    main()
