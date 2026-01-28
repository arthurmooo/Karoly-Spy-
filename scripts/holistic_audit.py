
import os
import sys
import tempfile
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from rich.console import Console
from rich.table import Table
from rich.progress import track

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.db.connector import DBConnector
from projectk_core.integrations.storage import StorageManager
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.logic.interval_engine import IntervalEngine, DetectionSource
from projectk_core.logic.interval_auditor import IntervalAuditor
from projectk_core.logic.models import Activity, ActivityMetadata

console = Console()

class CorrelationMatcher:
    @staticmethod
    def match(detected_intervals, reference_laps, min_overlap_pct=0.5):
        matches = []
        for i, det in enumerate(detected_intervals):
            best_ref_idx = -1
            max_overlap = 0
            
            det_start = det['start_time']
            det_end = det['end_time']
            det_dur = (det_end - det_start).total_seconds()
            
            if det_dur <= 0: continue

            for j, ref in enumerate(reference_laps):
                ref_start = ref['start_time']
                ref_end = ref['end_time']
                
                overlap_start = max(det_start, ref_start)
                overlap_end = min(det_end, ref_end)
                
                overlap_dur = max(0, (overlap_end - overlap_start).total_seconds())
                overlap_pct = overlap_dur / det_dur
                
                if overlap_pct > max_overlap:
                    max_overlap = overlap_pct
                    best_ref_idx = j
            
            if max_overlap >= min_overlap_pct:
                matches.append((i, best_ref_idx, max_overlap))
        return matches

def get_target_sessions():
    return [
        # Adrien
        {"nolio_id": 90341231, "athlete_nolio_id": 57896, "name": "Adrien HIT 15-45"},
        {"nolio_id": 90220426, "athlete_nolio_id": 57896, "name": "Adrien HIT 10-50"},
        {"nolio_id": 90148138, "athlete_nolio_id": 57896, "name": "Adrien 10Km Tempo"},
        {"nolio_id": 90091666, "athlete_nolio_id": 57896, "name": "Adrien 4*30' Tempo"},
        {"nolio_id": 88456295, "athlete_nolio_id": 57896, "name": "Adrien Bike Jan 7"},
        # Matthieu
        {"nolio_id": 90370443, "athlete_nolio_id": 138748, "name": "Matthieu 20*200m"},
        {"nolio_id": 90342370, "athlete_nolio_id": 138748, "name": "Matthieu 5*(1'+4')"},
        {"nolio_id": 89857218, "athlete_nolio_id": 138748, "name": "Matthieu 20*1'30\""},
        # Estelle-Marie
        {"nolio_id": 90364450, "athlete_nolio_id": 1824, "name": "Estelle LIT 1h00"},
        {"nolio_id": 88549362, "athlete_nolio_id": 57896, "name": "Adrien 88549362 (Fallback)"} # Need one more Estelle session if possible, using Adrien HIT for now
    ]

def audit_activity(session, db, storage, nolio):
    nolio_id = session['nolio_id']
    a_nolio_id = session['athlete_nolio_id']
    
    # 1. Fetch Activity Record for FIT Path
    act_record = db.client.table("activities").select("*").eq("nolio_id", nolio_id).execute().data
    if not act_record:
        return {"error": f"Session {nolio_id} not in DB"}
    act_record = act_record[0]
    
    path = act_record.get('fit_file_path')
    if not path:
        return {"error": "No FIT file"}

    # 2. Download & Parse FIT
    fit_data = storage.download_fit_file(path)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name
        
    try:
        df, meta, laps = UniversalParser.parse(tmp_path)
        if 'timestamp' in df.columns:
            df = df.set_index('timestamp')
        
        start_time = pd.to_datetime(act_record['session_date'], utc=True)
        sport = act_record['sport_type']
        
        # 3. Reference Laps (Nolio Ground Truth)
        ref_intervals = []
        for lap in laps:
            l_start = lap.get('start_time')
            if not l_start: continue
            if isinstance(l_start, str): l_start = pd.to_datetime(l_start, utc=True)
            elif l_start.tzinfo is None: l_start = l_start.replace(tzinfo=timezone.utc)
            
            dur = lap.get('total_elapsed_time') or lap.get('total_timer_time', 0)
            if not dur: continue
            ref_intervals.append({"start_time": l_start, "end_time": l_start + timedelta(seconds=dur)})
            
        # 4. Strategy A (Plan-Driven)
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
        
        engine_a = IntervalEngine(plan=plan, raw_laps=laps, streams=df.reset_index(), workout_start_time=start_time)
        blocks_a = engine_a.process()
        
        # 5. Strategy C (Pure Signal)
        engine_c = IntervalEngine(plan=None, raw_laps=None, streams=df.reset_index(), workout_start_time=start_time)
        blocks_c = engine_c.process()
        
        # 6. Audit Metrics for all sets
        class MockAct:
            def __init__(self, df, sport):
                self.df = df
                self.sport = sport
        
        auditor = IntervalAuditor(MockAct(df, sport))
        
        # Convert blocks to auditor format
        def blocks_to_auditor(blocks):
            return [{"start_time": start_time + timedelta(seconds=b.start_time), 
                     "end_time": start_time + timedelta(seconds=b.end_time)} for b in blocks if b.type == "active"]

        ref_metrics = auditor.audit(ref_intervals)
        a_metrics = auditor.audit(blocks_to_auditor(blocks_a))
        c_metrics = auditor.audit(blocks_to_auditor(blocks_c))
        
        # 7. Correlation
        matcher = CorrelationMatcher()
        # We match A to REF and C to REF
        matches_a = matcher.match(blocks_to_auditor(blocks_a), ref_intervals)
        matches_c = matcher.match(blocks_to_auditor(blocks_c), ref_intervals)
        
        return {
            "name": session['name'],
            "ref_count": len(ref_intervals),
            "a_count": len(a_metrics),
            "c_count": len(c_metrics),
            "ref_metrics": ref_metrics,
            "a_metrics": a_metrics,
            "c_metrics": c_metrics,
            "matches_a": matches_a,
            "matches_c": matches_c,
            "sport": sport,
            "device": act_record.get('device_id'),
            "temp": act_record.get('temp_avg'),
            "hum": act_record.get('humidity_avg')
        }
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def calculate_variance(val_pk, val_ref):
    if val_ref == 0 or val_ref is None or val_pk is None: return 0
    return (val_pk - val_ref) / val_ref

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--nolio_id", type=int)
    args = parser.parse_args()

    db = DBConnector()
    storage = StorageManager()
    nolio = NolioClient()
    
    sessions = get_target_sessions()
    if args.nolio_id:
        sessions = [s for s in sessions if s['nolio_id'] == args.nolio_id]
    
    sessions = sessions[:args.limit]
    results = []
    
    console.print(f"[bold green]Starting Holistic Parity Audit on {len(sessions)} sessions...[/bold green]")
    
    for s in track(sessions, description="Auditing sessions..."):
        res = audit_activity(s, db, storage, nolio)
        if "error" in res:
            console.print(f"[red]Error on {s['name']}: {res['error']}[/red]")
        else:
            results.append(res)
            
    # Summary Table
    table = Table(title="Holistic Audit Summary")
    table.add_column("Session")
    table.add_column("Sport")
    table.add_column("Device")
    table.add_column("Env (°C/%H)")
    table.add_column("Nolio Laps")
    table.add_column("Strat A")
    table.add_column("Strat C")
    table.add_column("A Parity (%)")
    
    for r in results:
        a_parity = (len(r['matches_a']) / r['ref_count'] * 100) if r['ref_count'] > 0 else 0
        env = f"{r['temp']}°/{r['hum']}%" if r['temp'] is not None else "-"
        
        table.add_row(
            r['name'],
            r['sport'],
            str(r['device'] or "-"),
            env,
            str(r['ref_count']),
            str(r['a_count']),
            str(r['c_count']),
            f"{a_parity:.1f}%"
        )
        
    console.print(table)
    
    # Detailed Variance Analysis (Metric Parity)
    var_table = Table(title="Metric Variance (Strategy A vs Nolio)")
    var_table.add_column("Session")
    var_table.add_column("Metric")
    var_table.add_column("Avg Variance")
    var_table.add_column("Max Variance")
    
    metrics_to_check = ["avg_hr", "avg_speed", "avg_power"]
    
    for r in results:
        for m in metrics_to_check:
            variances = []
            for a_idx, ref_idx, overlap in r['matches_a']:
                val_a = r['a_metrics'][a_idx].get(m)
                val_ref = r['ref_metrics'][ref_idx].get(m)
                if val_a and val_ref:
                    variances.append(abs(calculate_variance(val_a, val_ref)))
            
            if variances:
                avg_v = np.mean(variances) * 100
                max_v = np.max(variances) * 100
                var_table.add_row(r['name'], m, f"{avg_v:.2f}%", f"{max_v:.2f}%")
                
    console.print(var_table)

if __name__ == "__main__":
    main()
