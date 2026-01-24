import sys
import pandas as pd
from datetime import timedelta
from projectk_core.processing.parser import FitParser
from projectk_core.logic.interval_engine import IntervalEngine, DetectionSource

def format_duration(seconds):
    return str(timedelta(seconds=int(seconds)))

def verify_file(file_path):
    print(f"\nAnalyzing: {file_path}")
    print("="*60)
    
    try:
        # 1. Parse FIT File
        df, metadata, laps = FitParser.parse(file_path)
        print(f"Loaded {len(df)} data points.")
        print(f"Found {len(laps)} raw laps.")
        
        # Prepare streams for AlgoDetector
        start_time = df['timestamp'].iloc[0]
        df['time'] = (df['timestamp'] - start_time).dt.total_seconds()
        
        # 2. Run Interval Engine
        engine = IntervalEngine(plan=None, raw_laps=laps, streams=df, workout_start_time=start_time)
        detected_blocks = engine.process()
        
        print(f"\nDetected {len(detected_blocks)} intervals (Sources: Laps + Algo):")
        print("-" * 130)
        print(f"{ '#':<4} {'Start':<10} {'End':<10} {'Dur':<8} {'Type':<8} {'Source':<8} {'Speed':<6} {'Power':<6} {'HR':<6} {'Ratio':<6} {'Drift':<6}")
        print("-" * 130)
        
        for i, block in enumerate(detected_blocks):
            s = f"{block.avg_speed*3.6:.1f}" if block.avg_speed else "-"
            p = f"{block.avg_power:.0f}" if block.avg_power else "-"
            h = f"{block.avg_hr:.0f}" if block.avg_hr else "-"
            r = f"{block.pa_hr_ratio:.2f}" if block.pa_hr_ratio else "-"
            d = f"{block.decoupling*100:.1f}%" if block.decoupling is not None else "-"
            
            print(f"{i+1:<4} {format_duration(block.start_time):<10} {format_duration(block.end_time):<10} {format_duration(block.duration):<8} {block.type:<8} {block.detection_source.value:<8} {s:<6} {p:<6} {h:<6} {r:<6} {d:<6}")

        # 3. Test Algo Only (Force ignore laps)
        print("\n[TEST] Algo Detector Only (ignoring laps) - Active Blocks Only:")
        engine_algo = IntervalEngine(plan=None, raw_laps=None, streams=df, workout_start_time=start_time)
        algo_blocks = engine_algo.process()
        
        active_count = 0
        print(f"{ '#':<4} {'Start':<10} {'End':<10} {'Dur':<8} {'Type':<8} {'Speed':<6} {'Power':<6} {'HR':<6} {'Ratio':<6} {'Drift':<6}")
        print("-" * 90)
        for block in algo_blocks:
            if block.type == "active":
                active_count += 1
                s = f"{block.avg_speed*3.6:.1f}" if block.avg_speed else "-"
                p = f"{block.avg_power:.0f}" if block.avg_power else "-"
                h = f"{block.avg_hr:.0f}" if block.avg_hr else "-"
                r = f"{block.pa_hr_ratio:.2f}" if block.pa_hr_ratio else "-"
                d = f"{block.decoupling*100:.1f}%" if block.decoupling is not None else "-"
                print(f"{active_count:<4} {format_duration(block.start_time):<10} {format_duration(block.end_time):<10} {format_duration(block.duration):<8} {block.type:<8} {s:<6} {p:<6} {h:<6} {r:<6} {d:<6}")
        print(f"\nTotal Active Blocks: {active_count}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    files = [
        "data/test_cache/Adrien_2026-01-07.fit"
    ]
    
    for f in files:
        verify_file(f)
