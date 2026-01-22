
import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.logic.step_detector import StepDetector

def test_on_alexis():
    file_path = "./data/test_cache/Alexis_2025-10-17.fit"
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return

    print(f"📂 Loading Alexis session: {file_path}")
    df, metadata, laps = FitParser.parse(file_path)
    
    # Use speed as signal (Run session)
    signal = df['speed'].fillna(0).values
    
    detector = StepDetector(window_size=20, threshold_factor=1.5)
    steps = detector.detect_steps(signal)
    segments = detector.segment_by_steps(signal, steps)
    
    print(f"✅ Detected {len(steps)} steps.")
    print("\nDetected Segments:")
    for i, s in enumerate(segments):
        print(f" Seg {i+1}: {s['start']} -> {s['end']} ({s['duration']}s) | Mean Speed: {s['mean']:.2f} m/s")
    
    # Comparison with LAPs
    print("\nFIT Laps for comparison:")
    cumulative = 0
    for i, l in enumerate(laps):
        dur = l.get('total_elapsed_time', 0)
        spd = l.get('avg_speed', 0)
        print(f" Lap {i+1}: {cumulative} -> {cumulative + int(dur)} ({int(dur)}s) | Avg Speed: {spd:.2f}")
        cumulative += int(dur)

if __name__ == "__main__":
    test_on_alexis()
