
import os
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Type
import abc

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import UniversalParser

class BaseDetector(abc.ABC):
    @abc.abstractmethod
    def detect(self, df: pd.DataFrame, sport: str) -> List[Dict]:
        """Returns list of intervals {'start': datetime, 'end': datetime}"""
        pass

    @property
    @abc.abstractmethod
    def name(self) -> str:
        pass

class KMeansDetector(BaseDetector):

    """Current Baseline using 3-Cluster Logic in AlgoDetector."""

    @property

    def name(self): return "Baseline (3-Cluster)"

    

    def detect(self, df, sport):

        from projectk_core.logic.interval_engine import AlgoDetector

        

        # Prepare DF for AlgoDetector (needs 'time' column)

        df_algo = df.copy()

        start_time = df_algo.index[0]

        df_algo['time'] = (df_algo.index - start_time).total_seconds()

        

        detector = AlgoDetector(df_algo)

        blocks = detector.detect()

        

        # Convert IntervalBlocks to dicts with absolute datetimes

        results = []

        for b in blocks:

            if b.type == "active":

                results.append({

                    "start": start_time + timedelta(seconds=b.start_time),

                    "end": start_time + timedelta(seconds=b.end_time)

                })

        return results



class BenchmarkRunner:

    def __init__(self, ground_truth_path: str):

        with open(ground_truth_path, 'r') as f:

            self.ground_truth = json.load(f)

            

    def run(self, detector: BaseDetector, target_keys: List[str] = None):

        results = {}

        target_keys = target_keys or list(self.ground_truth.keys())

        

        for key in target_keys:

            print(f"Benchmarking {detector.name} on {key}...")

            file_path = f"data/test_cache/{key}.fit"

            if "Alexis" in key: file_path = "data/test_cache/Bernard_2025-10-17.fit"

            

            try:

                df, meta, laps = UniversalParser.parse(file_path)

                if 'timestamp' in df.columns:

                    df = df.set_index('timestamp')

                

                sport = "Running" # Default for these tests

                

                detected = detector.detect(df, sport)

                gt = self.ground_truth[key]

                

                # Filter GT: only keep "active" laps if they represent the core workout

                # For now we take ALL from GT because we prepared it this way.

                

                metrics = self.evaluate(detected, gt)

                results[key] = metrics

            except Exception as e:

                print(f"  Error on {key}: {e}")

                import traceback

                traceback.print_exc()

            

        return results

    def evaluate(self, detected: List[Dict], ground_truth: List[Dict]):
        """
        Evaluate detected intervals against ground truth.
        Metrics:
        - Recall: % of GT intervals found (IoU > 0.5)
        - Precision: % of detected intervals that match a GT (IoU > 0.5)
        - Mean Time Error (Start/End)
        - Mean HR Error
        """
        if not detected:
            return {"score": 0, "found": 0, "total": len(ground_truth)}
            
        matches = []
        gt_found = [False] * len(ground_truth)
        
        for d in detected:
            d_start = d['start'] if isinstance(d['start'], datetime) else pd.to_datetime(d['start'], utc=True)
            d_end = d['end'] if isinstance(d['end'], datetime) else pd.to_datetime(d['end'], utc=True)
            
            best_iou = 0
            best_gt_idx = -1
            
            for i, g in enumerate(ground_truth):
                g_start = pd.to_datetime(g['start'], utc=True)
                g_end = pd.to_datetime(g['end'], utc=True)
                
                # IoU
                intersection = max(0, (min(d_end, g_end) - max(d_start, g_start)).total_seconds())
                union = (d_end - d_start).total_seconds() + (g_end - g_start).total_seconds() - intersection
                iou = intersection / union if union > 0 else 0
                
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = i
            
            if best_iou > 0.5:
                gt_found[best_gt_idx] = True
                matches.append({
                    "detected": d,
                    "gt": ground_truth[best_gt_idx],
                    "iou": best_iou,
                    "start_error": (d_start - pd.to_datetime(ground_truth[best_gt_idx]['start'], utc=True)).total_seconds(),
                    "end_error": (d_end - pd.to_datetime(ground_truth[best_gt_idx]['end'], utc=True)).total_seconds()
                })
        
        found_count = sum(gt_found)
        precision = len(matches) / len(detected) if detected else 0
        recall = found_count / len(ground_truth) if ground_truth else 0
        
        avg_start_err = np.mean([abs(m['start_error']) for m in matches]) if matches else None
        avg_end_err = np.mean([abs(m['end_error']) for m in matches]) if matches else None
        
        return {
            "precision": precision,
            "recall": recall,
            "found": found_count,
            "total": len(ground_truth),
            "avg_start_error": avg_start_err,
            "avg_end_error": avg_end_err,
            "avg_iou": np.mean([m['iou'] for m in matches]) if matches else 0
        }

if __name__ == "__main__":
    runner = BenchmarkRunner("data/test_cache/benchmark_ground_truth.json")
    baseline = KMeansDetector()
    results = runner.run(baseline)
    
    print("\n--- BENCHMARK RESULTS ---")
    for key, m in results.items():
        print(f"\nActivity: {key}")
        print(f"  Recall: {m['recall']:.1%} ({m['found']}/{m['total']})")
        print(f"  Precision: {m['precision']:.1%}")
        if m['avg_start_error'] is not None:
            print(f"  Avg Start Error: {m['avg_start_error']:.1f}s")
            print(f"  Avg End Error: {m['avg_end_error']:.1f}s")
            print(f"  Avg IoU: {m['avg_iou']:.2f}")
