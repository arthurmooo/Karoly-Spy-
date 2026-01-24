import os
import sys
import pandas as pd
from datetime import datetime, timedelta
from rich.console import Console
from rich.table import Table

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import UniversalParser
from projectk_core.logic.interval_engine import AlgoDetector

console = Console()

FILES = [
    ("Adrien Claeyssen", "2026-01-07", "data/test_cache/Adrien_2026-01-07.fit", "Run"),
    ("Baptiste Delmas", "2026-01-09", "data/test_cache/Baptiste_2026-01-09.fit", "Run"),
    ("Bernard Alexis", "2025-10-17", "data/test_cache/Bernard_2025-10-17.fit", "Run"),
    ("Dries Matthys", "2026-01-17", "data/test_cache/Dries_2026-01-17.fit", "Run"),
]

def format_time(seconds):
    return str(timedelta(seconds=int(seconds)))

def process_one(name, date, path, sport):
    console.print(f"\n[bold cyan]=== {name} ({date}) ===[/bold cyan]")
    if not os.path.exists(path):
        console.print(f"[red]File not found: {path}[/red]")
        return

    try:
        df, meta, raw_laps = UniversalParser.parse(path)
        if 'timestamp' in df.columns:
            df = df.set_index('timestamp')
        
        df_algo = df.copy()
        start_ts = df_algo.index[0]
        df_algo['time'] = (df_algo.index - start_ts).total_seconds()
        
        detector = AlgoDetector(df_algo)
        blocks = detector.detect()
        
        table = Table(title=f"ULTRA Detection: {name}")
        table.add_column("#", justify="right")
        table.add_column("Type", justify="center")
        table.add_column("Start", justify="center")
        table.add_column("Dur", justify="right")
        table.add_column("Avg HR", justify="right")
        
        if "Run" in sport:
            table.add_column("Speed (km/h)", justify="right")
        else:
            table.add_column("Power (W)", justify="right")
            
        active_idx = 1
        for b in blocks:
            if b.type != "active": continue
            
            mask = (df_algo['time'] >= b.start_time) & (df_algo['time'] <= b.end_time)
            seg = df_algo.loc[mask]
            
            avg_hr = seg['heart_rate'].mean() if 'heart_rate' in seg.columns else 0
            avg_speed = seg['speed'].mean() * 3.6 if 'speed' in seg.columns else 0
            avg_power = seg['power'].mean() if 'power' in seg.columns else 0
            
            perf = f"{avg_speed:.1f}" if "Run" in sport else f"{avg_power:.0f}"
            
            table.add_row(
                str(active_idx),
                b.type.upper(),
                format_time(b.start_time),
                f"{int(b.duration)}s",
                f"{avg_hr:.0f}",
                perf
            )
            active_idx += 1
            
        console.print(table)
    except Exception as e:
        console.print(f"[red]Error on {name}: {e}[/red]")

def main():
    for f in FILES:
        process_one(*f)

if __name__ == "__main__":
    main()
