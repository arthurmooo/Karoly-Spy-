import os
import json
import pandas as pd
from projectk_core.logic.interval_engine import IntervalEngine
from projectk_core.processing.parser import FitParser
from rich.console import Console
from rich.table import Table

console = Console()

# Load Ground Truth
GROUND_TRUTH_PATH = "data/test_cache/audit_ground_truth.json"
with open(GROUND_TRUTH_PATH, "r") as f:
    GROUND_TRUTH = json.load(f)

def time_to_seconds(t_str):
    if not t_str: return 0
    parts = str(t_str).split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(float(t_str))

def format_seconds(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"

def audit_session(name, fit_path):
    console.print(f"\n[bold blue]--- AUDIT ROBUSTNESS: {name} ({fit_path}) ---[/bold blue]")
    if not os.path.exists(fit_path):
        console.print(f"[red]❌ Fichier non trouvé: {fit_path}[/red]")
        return

    # Parse FIT File
    records_df, metadata, laps = FitParser.parse(fit_path)
    
    # Ensure 'time' column exists for AlgoDetector
    if 'timestamp' in records_df.columns:
        start_ts = records_df['timestamp'].iloc[0]
        records_df['time'] = (records_df['timestamp'] - start_ts).dt.total_seconds()

    # FORCE ALGO ONLY (No plan, No laps)
    engine = IntervalEngine(
        plan=None,
        raw_laps=None, 
        streams=records_df, 
        workout_start_time=metadata.get('start_time')
    )
    detected_intervals = engine.process()
    
    # Filter only ACTIVE intervals for comparison
    active_intervals = [b for b in detected_intervals if b.type == "active"]
    
    reference = GROUND_TRUTH.get(name, [])
    
    # Matching logic: for each reference interval, find the best matching detected interval
    # We use a simple time-based proximity match
    results = []
    for i, ref in enumerate(reference):
        ref_duration = time_to_seconds(ref['time'])
        
        # Simple heuristic: find detected interval that overlaps or is closest in time
        # Since we don't have absolute start times for reference (Nolio only gives durations),
        # we assume sequential order and try to match the i-th active interval.
        
        if i < len(active_intervals):
            calc = active_intervals[i]
            calc_time = calc.duration
            calc_speed_kmh = (calc.avg_speed * 3.6) if calc.avg_speed else 0
            
            delta_time = calc_time - ref_duration
            delta_dist = calc.distance_m - ref['dist']
            delta_hr = (calc.avg_hr - ref['hr']) if calc.avg_hr else 0
            delta_speed = calc_speed_kmh - ref['speed']
            
            results.append({
                "Tour": i + 1,
                "Ref_Dur": ref['time'],
                "Algo_Dur": format_seconds(calc_time),
                "Δ_Dur": f"{delta_time:+.0f}s",
                "Ref_Dist": ref['dist'],
                "Algo_Dist": round(calc.distance_m, 1) if calc.distance_m else 0,
                "Δ_Dist": f"{delta_dist:+.1f}m",
                "Ref_HR": ref['hr'],
                "Algo_HR": round(calc.avg_hr, 1) if calc.avg_hr else 0,
                "Δ_HR": f"{delta_hr:+.1f}",
                "Ref_Spd": ref['speed'],
                "Algo_Spd": round(calc_speed_kmh, 2),
                "Δ_Spd": f"{delta_speed:+.2f}"
            })
        else:
            results.append({
                "Tour": i + 1,
                "Ref_Dur": ref['time'],
                "Algo_Dur": "MISSING",
                "Δ_Dur": "-", "Ref_Dist": ref['dist'], "Algo_Dist": "-", "Δ_Dist": "-",
                "Ref_HR": ref['hr'], "Algo_HR": "-", "Δ_HR": "-",
                "Ref_Spd": ref['speed'], "Algo_Spd": "-", "Δ_Spd": "-"
            })

    # Add extra detected intervals that weren't matched
    if len(active_intervals) > len(reference):
        for j in range(len(reference), len(active_intervals)):
            calc = active_intervals[j]
            results.append({
                "Tour": j + 1,
                "Ref_Dur": "-",
                "Algo_Dur": format_seconds(calc.duration),
                "Δ_Dur": "EXTRA",
                "Ref_Dist": "-", "Algo_Dist": round(calc.distance_m, 1), "Δ_Dist": "-",
                "Ref_HR": "-", "Algo_HR": round(calc.avg_hr, 1), "Δ_HR": "-",
                "Ref_Spd": "-", "Algo_Spd": round(calc.avg_speed * 3.6, 2), "Δ_Spd": "-"
            })

    # Display Table
    table = Table(title=f"Robustness Audit: {name}")
    for key in results[0].keys():
        table.add_column(key)
    
    for row in results:
        table.add_row(*[str(v) for v in row.values()])
        
    console.print(table)
    
    # Calculate Summary Stats for Active matching
    valid_results = [r for r in results if r['Algo_Dur'] != "MISSING" and r['Δ_Dur'] != "EXTRA"]
    if valid_results:
        avg_delta_hr = sum(abs(float(r['Δ_HR'])) for r in valid_results) / len(valid_results)
        avg_delta_dur = sum(abs(int(r['Δ_Dur'].replace('s',''))) for r in valid_results) / len(valid_results)
        console.print(f"[bold]Summary for {name}:[/bold]")
        console.print(f"  Avg |Δ_HR|: {avg_delta_hr:.2f} bpm")
        console.print(f"  Avg |Δ_Dur|: {avg_delta_dur:.2f} s")
        console.print(f"  Detected: {len(active_intervals)} | Expected: {len(reference)}")
    
    return results

if __name__ == "__main__":
    sessions = [
        ("Adrien", "data/test_cache/Adrien_2026-01-07.fit"),
        ("Baptiste", "data/test_cache/Baptiste_2026-01-09.fit"),
        ("Alexis", "data/test_cache/Bernard_2025-10-17.fit"),
        ("Dries", "data/test_cache/Dries_2026-01-11.fit")
    ]
    
    all_results = {}
    for name, path in sessions:
        all_results[name] = audit_session(name, path)
