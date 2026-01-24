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
        # Rename timestamp to time (seconds from start) for consistency with tests
        start_time = df['timestamp'].iloc[0]
        df['time'] = (df['timestamp'] - start_time).dt.total_seconds()
        
        # 2. Run Interval Engine (No Plan - Priority 2 & 3 only)
        # We pass raw laps and streams. The engine uses EnsembleVoter to fuse.
        engine = IntervalEngine(plan=None, raw_laps=laps, streams=df, workout_start_time=start_time)
        detected_blocks = engine.process()
        
        print(f"\nDetected {len(detected_blocks)} intervals (Sources: Laps + Algo):")
        print("-" * 80)
        print(f"{ '#':<4} {'Start':<10} {'End':<10} {'Duration':<10} {'Type':<10} {'Source':<10}")
        print("-" * 80)
        
        for i, block in enumerate(detected_blocks):
            print(f"{i+1:<4} {format_duration(block.start_time):<10} {format_duration(block.end_time):<10} {format_duration(block.duration):<10} {block.type:<10} {block.detection_source.value:<10}")

        # 3. Test Algo Only (Force ignore laps)
        print("\n[TEST] Algo Detector Only (ignoring laps):")
        engine_algo = IntervalEngine(plan=None, raw_laps=None, streams=df, workout_start_time=start_time)
        algo_blocks = engine_algo.process()
        print(f"Detected {len(algo_blocks)} intervals via Signal Analysis:")
        for i, block in enumerate(algo_blocks[:10]): # Show first 10
             print(f"{i+1:<4} {format_duration(block.start_time):<10} {format_duration(block.end_time):<10} {format_duration(block.duration):<10} {block.type:<10} {block.detection_source.value:<10}")
        if len(algo_blocks) > 10: print("... (truncated)")

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
