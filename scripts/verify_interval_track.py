import sys
import os
import pandas as pd
from rich.console import Console
from rich.table import Table
import tempfile

# Add project root
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import TextPlanParser
from projectk_core.logic.interval_detector import IntervalDetector
from projectk_core.logic.models import Activity, ActivityMetadata

console = Console()

def main():
    targets = [
        # Run 5x2km
        {'id': '5532d66d-078e-4e2e-9830-8d25ab745c72', 'force_title': "5*2Km Z2/ r 500m"},
        # Run 20x1'30"
        {'id': '39d0efbc-6c0b-4aa6-b4d4-2edff1c282ca', 'force_title': "20*1'30'' Z2/ r 45''"},
        # Bike 4x15'
        {'id': '5d83741d-7bb5-4428-97b3-6fda8425b982', 'force_title': "4*15' LT1"},
        # Bike 4x4' (Hybrid Fallback Success)
        {'id': '8e822b22-3474-421e-b974-3892b360ba1b', 'force_title': "4*4' Z3/ r 4'"},
    ]
    
    db = DBConnector()
    storage = StorageManager()
    parser = UniversalParser()
    plan_parser = TextPlanParser()
    detector = IntervalDetector()
    
    for target in targets:
        analyze_activity(target, db, storage, parser, plan_parser, detector)

def analyze_activity(target, db, storage, parser, plan_parser, detector):
    act_id = target['id']
    force_title = target['force_title']
    
    # Fetch
    try:
        record = db.client.table("activities").select("*").eq("id", act_id).single().execute().data
    except Exception as e:
        console.print(f"[red]Activity {act_id} not found or error: {e}[/red]")
        return

    name = record.get('activity_name') or force_title
    sport = record.get('sport_type')
    
    console.print(f"\n[bold blue]=== Analyzing: {name} ({sport}) ===[/bold blue]")
    
    # Download
    fit_data = storage.download_fit_file(record['fit_file_path'])
    if not fit_data:
        console.print("[red]No FIT file.[/red]")
        return
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    try:
        # Parse
        df, meta, laps = parser.parse(tmp_path)
        
        # Build Activity Object
        activity = Activity(
            metadata=ActivityMetadata(
                activity_type=sport, 
                start_time=pd.to_datetime(record['session_date']),
                duration_sec=len(df)
            ),
            streams=df,
            laps=laps
        )
        
        if laps:
            console.print(f"   [cyan]Laps Found in File:[/cyan] {len(laps)}")
            for i, l in enumerate(laps[:5]):
                console.print(f"     - Lap {i+1}: {l.get('total_elapsed_time')}s | {l.get('avg_power')}W")
        else:
            console.print("   [red]No Laps in File.[/red]")
        
        # Parse Plan
        plan = plan_parser.parse(force_title)
        if plan:
            console.print(f"   [green]Plan Parsed:[/green] {len(plan)} intervals found from title.")
            # Convert to detector format
            # The detector expects either a list (new) or dict (legacy)
            # We pass the list directly as we updated IntervalDetector to handle it (via Matcher)
            pass
        else:
            console.print("   [yellow]No plan parsed from title.[/yellow]")
            
        # Detect
        # We need to manually construct the list for the Matcher if using TextPlanParser
        # TextPlanParser returns list of dicts.
        
        # Run Detection
        result = detector.detect(activity, plan)
        
        # Output Results
        if not result or not result.get('blocks'):
            console.print("   [red]No intervals detected.[/red]")
            return
            
        blocks = result['blocks']
        detailed = result.get('detailed_matches', [])
        
        console.print(f"   [bold]Global Metrics:[/bold] Mean P: {result.get('interval_power_mean')}W | Mean HR: {result.get('interval_hr_mean')}bpm")
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("#")
        table.add_column("Type")
        table.add_column("Dur (Act/Plan)")
        table.add_column("Power")
        table.add_column("HR")
        table.add_column("Source")
        table.add_column("Status")
        
        # Iterate over DETAILED matches if available to show status
        if detailed:
            for i, m in enumerate(detailed):
                idx = str(i + 1)
                type_ = m['target']['type']
                dur = f"{m['duration_sec']}s / {m['expected_duration']}s"
                
                p_val = m.get('plateau_avg_power') or m.get('avg_power') or 0
                hr_val = m.get('avg_hr') or 0
                
                p = f"{p_val:.0f}W"
                hr = f"{hr_val:.0f}bpm"
                src = m['source'] or "-"
                status = m['status']
                
                style = "green" if status == "matched" else "red"
                table.add_row(idx, type_, dur, p, hr, src, f"[{style}]{status}[/{style}]")
        else:
            # Fallback to blocks
            for i, b in enumerate(blocks):
                table.add_row(str(i+1), "?", f"{b['duration_sec']}s", f"{b['avg_power']}W", f"{b['avg_hr']}bpm", "Legacy", "Detected")
                
        console.print(table)

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    main()
