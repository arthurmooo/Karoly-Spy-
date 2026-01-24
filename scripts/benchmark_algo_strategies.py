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
    def name(self):
        return "Baseline (3-Cluster)"
    
    def detect(self, df, sport):
        from projectk_core.logic.interval_engine import AlgoDetector
        
        # Prepare DF for AlgoDetector (needs 'time' column)
        df_algo = df.copy()
        if df_algo.empty: return []
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

class GradientDetector(BaseDetector):
    """Strategy A: Detecting changes via signal gradient (rupture)."""
    @property
    def name(self):
        return "Strategy A (Gradient)"
    
    def detect(self, df, sport):
        signal_col = "power" if "power" in df.columns else "speed"
        signal = df[signal_col].fillna(0)
        
        # Smooth and calculate gradient
        signal_smooth = signal.rolling(window=15, center=True).mean().fillna(signal)
        gradient = signal_smooth.diff().abs()
        
        # Threshold for gradient: high change means potential start/end
        grad_threshold = gradient.quantile(0.90)
        
        # Refinement: Use signal level + gradient
        avg_signal = signal_smooth.mean()
        is_high = signal_smooth > avg_signal
        
        diff = is_high.astype(int).diff().fillna(0)
        starts = df.loc[diff == 1].index.tolist()
        ends = df.loc[diff == -1].index.tolist()
        
        if is_high.iloc[0]: starts.insert(0, df.index[0])
        if is_high.iloc[-1]: ends.append(df.index[-1])
        
        results = []
        for s, e in zip(starts, ends):
            if (e - s).total_seconds() >= 15:
                results.append({"start": s, "end": e})
        return results

class UltraDetector(BaseDetector):
    """🚀 Strategy ULTRA V5: The Surgeon.
    Uses multi-scale histogram valley detection, hysteresis thresholding,
    and raw-signal sub-second edge refinement.
    """
    @property
    def name(self): return "Strategy ULTRA V5 (Surgeon)"
    
    def detect(self, df, sport):
        signal_col = "power" if "power" in df.columns else "speed"
        if signal_col not in df.columns: return []
        
        signal = df[signal_col].fillna(0)
        s_mid = signal.rolling(window=15, center=True).mean().fillna(signal)
        
        # 1. Histogram-based optimal threshold
        non_zero = s_mid[s_mid > s_mid.max() * 0.1]
        if non_zero.empty: non_zero = s_mid
        hist, bins = np.histogram(non_zero, bins=40)
        bin_centers = (bins[:-1] + bins[1:]) / 2
        
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(hist, distance=3, height=len(non_zero)*0.03)
        
        if len(peaks) >= 2:
            sorted_peaks = sorted(peaks)
            p_rest = sorted_peaks[0]
            p_work = sorted_peaks[-1]
            valley_idx = np.argmin(hist[p_rest:p_work]) + p_rest
            threshold_high = bin_centers[valley_idx]
            threshold_low = bin_centers[p_rest] + (threshold_high - bin_centers[p_rest]) * 0.5
        else:
            threshold_high = non_zero.quantile(0.70)
            threshold_low = non_zero.quantile(0.50)
            
        # 2. Hysteresis Thresholding
        is_active = pd.Series(False, index=df.index)
        currently_active = False
        for i in range(len(s_mid)):
            val = s_mid.iloc[i]
            if not currently_active and val > threshold_high:
                currently_active = True
            elif currently_active and val < threshold_low:
                currently_active = False
            is_active.iloc[i] = currently_active
            
        # 3. Clean Spikes/Gaps
        is_active = is_active.rolling(window=10, center=True).max().fillna(is_active).astype(bool)
        is_active = is_active.rolling(window=15, center=True).min().fillna(is_active).astype(bool)
        
        diff = is_active.astype(int).diff().fillna(0)
        starts = df.loc[diff == 1].index.tolist()
        ends = df.loc[diff == -1].index.tolist()
        if is_active.iloc[0]: starts.insert(0, df.index[0])
        if is_active.iloc[-1]: ends.append(df.index[-1])
        
        # 4. Raw Signal Edge Refinement
        raw_smooth = signal.rolling(window=2, center=True).mean().fillna(signal)
        raw_grad = np.gradient(raw_smooth.values)
        grad_series = pd.Series(raw_grad, index=df.index)
        
        refined = []
        for s, e in zip(starts, ends):
            # Window for search: +/- 20s
            s_win = grad_series.loc[s - timedelta(seconds=20) : s + timedelta(seconds=20)]
            if not s_win.empty: s = s_win.idxmax()
            
            e_win = grad_series.loc[e - timedelta(seconds=20) : e + timedelta(seconds=20)]
            if not e_win.empty: e = e_win.idxmin()
            
            if (e - s).total_seconds() >= 15:
                refined.append({"start": s, "end": e})
        
        # 5. Smart Filtering (The "Main Set" logic)
        if len(refined) > 3:
            durs = [(r['end'] - r['start']).total_seconds() for r in refined]
            median_dur = np.median(durs)
            # Keep blocks that are either long OR similar to the median
            # This helps remove warmup/cooldown blips
            filtered = []
            for r in refined:
                dur = (r['end'] - r['start']).total_seconds()
                if dur > 300: # Always keep long blocks
                    filtered.append(r)
                elif 0.5 * median_dur <= dur <= 1.5 * median_dur:
                    filtered.append(r)
            return filtered
            
        return refined

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
                
                sport = "Running"
                
                detected = detector.detect(df, sport)
                gt = self.ground_truth[key]
                
                # Enrich detected with metrics
                for d in detected:
                    seg = df.loc[d['start']:d['end']]
                    if not seg.empty:
                        d['avg_hr'] = float(seg['heart_rate'].mean()) if 'heart_rate' in df.columns else None
                        d['avg_speed'] = float(seg['speed'].mean()) if 'speed' in df.columns else None
                        d['avg_power'] = float(seg['power'].mean()) if 'power' in df.columns else None
                
                metrics = self.evaluate(detected, gt)
                results[key] = metrics
            except Exception as e:
                print(f"  Error on {key}: {e}")
            
        return results

    def evaluate(self, detected: List[Dict], ground_truth: List[Dict]):
        if not detected:
            return {"precision": 0, "recall": 0, "found": 0, "total": len(ground_truth), "avg_start_error": None, "avg_end_error": None, "avg_hr_error": None, "avg_iou": 0}
            
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
                
                intersection = max(0, (min(d_end, g_end) - max(d_start, g_start)).total_seconds())
                union = (d_end - d_start).total_seconds() + (g_end - g_start).total_seconds() - intersection
                iou = intersection / union if union > 0 else 0
                
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = i
            
            if best_iou > 0.4:
                gt_found[best_gt_idx] = True
                
                g = ground_truth[best_gt_idx]
                hr_err = None
                if d.get('avg_hr') and g.get('avg_hr'):
                    hr_err = d['avg_hr'] - g['avg_hr']
                
                matches.append({
                    "detected": d,
                    "gt": g,
                    "iou": best_iou,
                    "start_error": (d_start - pd.to_datetime(g['start'], utc=True)).total_seconds(),
                    "end_error": (d_end - pd.to_datetime(g['end'], utc=True)).total_seconds(),
                    "hr_error": hr_err
                })
        
        found_count = sum(gt_found)
        precision = len(matches) / len(detected) if detected else 0
        recall = found_count / len(ground_truth) if ground_truth else 0
        
        avg_start_err = np.mean([abs(m['start_error']) for m in matches]) if matches else None
        avg_end_err = np.mean([abs(m['end_error']) for m in matches]) if matches else None
        avg_hr_err = np.mean([abs(m['hr_error']) for m in matches if m['hr_error'] is not None]) if matches else None
        
        return {
            "precision": precision,
            "recall": recall,
            "found": found_count,
            "total": len(ground_truth),
            "avg_start_error": avg_start_err,
            "avg_end_error": avg_end_err,
            "avg_hr_error": avg_hr_err,
            "avg_iou": np.mean([m['iou'] for m in matches]) if matches else 0
        }

if __name__ == "__main__":
    runner = BenchmarkRunner("data/test_cache/benchmark_ground_truth.json")
    strategies = [
        KMeansDetector(), 
        GradientDetector(), 
        UltraDetector()
    ]
    
    for strategy in strategies:
        results = runner.run(strategy)
        
        print(f"\n--- RESULTS FOR {strategy.name} ---")
        for key, m in results.items():
            print(f"\nActivity: {key}")
            print(f"  Recall: {m['recall']:.1%} ({m['found']}/{m['total']})")
            print(f"  Precision: {m['precision']:.1%}")
            if m['avg_start_error'] is not None:
                print(f"  Avg Start Error: {m['avg_start_error']:.1f}s")
                print(f"  Avg End Error: {m['avg_end_error']:.1f}s")
                if m['avg_hr_error'] is not None:
                    print(f"  Avg HR Error: {m['avg_hr_error']:.2f} bpm")
                print(f"  Avg IoU: {m['avg_iou']:.2f}")