import sys
import os
import tempfile
import pandas as pd
import numpy as np
from rich.console import Console
from rich.table import Table
from datetime import datetime, timedelta, timezone

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import UniversalParser
from projectk_core.logic.plan_driven_seeker import PlanDrivenSeeker
from projectk_core.logic.meta_seeker import MetaSeeker

console = Console()

def benchmark():
    # Activity: 10*2' Z3/ r 1' (Adrien Claeyssen)
    fit_path = "9f82e8ce-1ae7-48ef-9576-33d7ed6fe331/2026/88478697.fit"
    
    db = DBConnector()
    storage = StorageManager()
    
    console.print(f"[bold green]Downloading FIT file: {fit_path}...[/bold green]")
    try:
        fit_data = storage.download_fit_file(fit_path)
    except Exception as e:
        console.print(f"[red]Failed to download: {e}[/red]")
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name

    try:
        df, meta, laps = UniversalParser.parse(tmp_path)
        if 'timestamp' in df.columns:
            df = df.set_index('timestamp')
        
        # 1. Source of Truth: Laps (from file)
        # We focus on the 10 work intervals.
        work_laps = []
        for lap in laps:
            dur = lap.get('total_timer_time', 0)
            if 115 <= dur <= 125: # Work intervals are 120s
                work_laps.append(lap)
        
        if len(work_laps) != 10:
            console.print(f"[yellow]Warning: Found {len(work_laps)} work laps instead of 10.[/yellow]")
        
        # 2. Seekers
        start_ts = df.index[0]
        df['time'] = (df.index - start_ts).total_seconds()
        
        classic_seeker = PlanDrivenSeeker(df, primary_signal='power')
        meta_seeker = MetaSeeker(df, primary_signal='power', resolution_hz=20)
        
        table = Table(title="Benchmark: Classic vs Meta (Spline) vs Laps")
        table.add_column("Lap #", justify="center")
        table.add_column("Lap Start (s)", justify="right", style="cyan")
        table.add_column("Classic Start", justify="right", style="magenta")
        table.add_column("Meta Start", justify="right", style="green")
        table.add_column("Err Classic (s)", justify="right")
        table.add_column("Err Meta (s)", justify="right")
        table.add_column("Power (Lap)", justify="right")
        table.add_column("Power (Meta)", justify="right")

        total_err_classic = 0
        total_err_meta = 0
        
        for i, lap in enumerate(work_laps):
            lap_start_dt = lap['start_time']
            if lap_start_dt.tzinfo is None: lap_start_dt = lap_start_dt.replace(tzinfo=timezone.utc)
            lap_start_s = (lap_start_dt - start_ts).total_seconds()
            lap_dur = lap['total_timer_time']
            lap_pwr = lap.get('avg_power', 0)
            
            # Classic Seek
            c_res = classic_seeker.seek(int(lap_dur), int(lap_start_s), search_window=10)
            
            # Meta Seek
            m_res = meta_seeker.seek(int(lap_dur), int(lap_start_s), search_window=10)
            
            err_c = abs(c_res['start'] - lap_start_s) if c_res else 999
            err_m = abs(m_res['start'] - lap_start_s) if m_res else 999
            
            total_err_classic += err_c
            total_err_meta += err_m
            
            row = [
                str(i+1),
                f"{lap_start_s:.1f}",
                f"{c_res['start']:.1f}" if c_res else "N/A",
                f"{m_res['start']:.3f}" if m_res else "N/A",
                f"{err_c:.2f}",
                f"{err_m:.3f}",
                f"{lap_pwr:.0f}W",
                f"{m_res['avg']:.1f}W" if m_res else "N/A"
            ]
            
            # Highlight if Meta is better
            if err_m < err_c:
                row[5] = f"[bold green]{row[5]}[/bold green]"
            
            table.add_row(*row)
            
        console.print(table)
        
        avg_err_c = total_err_classic / len(work_laps)
        avg_err_m = total_err_meta / len(work_laps)
        
        console.print(f"\n[bold]Average Error (Classic): {avg_err_c:.3f}s[/bold]")
        console.print(f"[bold]Average Error (Meta):    {avg_err_m:.3f}s[/bold]")
        
        if avg_err_m < avg_err_c:
            console.print("\n[bold green]🏆 Meta Precision is BETTER! 🏆[/bold green]")
        else:
            console.print("\n[bold red]Meta Precision did not improve results.[/bold red]")

    except Exception as e:
        import traceback
        traceback.print_exc()
        console.print(f"[red]Error: {e}[/red]")
    finally:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    benchmark()
