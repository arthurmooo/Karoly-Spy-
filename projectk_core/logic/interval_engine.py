from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import PlannedStructure, IntervalBlock, DetectionSource

def _normalize_cadence(value: Optional[float], sport: Optional[str] = None) -> Optional[float]:
    if value is None:
        return None
    if sport and sport.lower() == "run":
        return float(value) * 2.0
    return float(value)

class IntervalEngine:
    """
    Core engine for high-precision interval detection.
    
    Fusion Strategy:
    1. Plan Correlation (Priority 1)
    2. Lap Analysis (Priority 2)
    3. Algorithmic Detection (Priority 3)
    """
    def __init__(self, plan: Optional[PlannedStructure] = None, raw_laps: Optional[List[Dict[str, Any]]] = None, streams: Optional[pd.DataFrame] = None, workout_start_time: Optional[datetime] = None, sport: Optional[str] = None):
        self.plan = plan
        self.raw_laps = raw_laps
        self.streams = streams
        self.workout_start_time = workout_start_time
        self.sport = sport
        self.audit_log = []

    def process(self) -> List[IntervalBlock]:
        """
        Execute the full fusion pipeline.
        """
        plan_blocks = PlanProjector(self.plan).project() if self.plan else []
        lap_blocks = LapAnalyzer(self.raw_laps, reference_start_time=self.workout_start_time, sport=self.sport).to_blocks() if self.raw_laps else []
        algo_blocks = AlgoDetector(self.streams).detect() if self.streams is not None else []
        
        voter = EnsembleVoter(plan_blocks, lap_blocks, algo_blocks)
        fused_blocks = voter.fuse()
        self.audit_log = voter.audit_log
        
        # Calculate metrics for fused blocks
        if self.streams is not None:
            calculator = IntervalMetricsCalculator(self.streams, sport=self.sport)
            fused_blocks = [calculator.calculate(b) for b in fused_blocks]
            
        return fused_blocks

class PlanProjector:
    """
    Maps a PlannedStructure onto a theoretical timeline.
    """
    def __init__(self, plan: PlannedStructure):
        self.plan = plan

    def project(self) -> List[IntervalBlock]:
        """
        Convert planned intervals into a list of IntervalBlocks with theoretical timestamps.
        """
        projected = []
        current_time = 0.0
        
        for p_interval in self.plan.intervals:
            duration = p_interval.duration or (1.0 if p_interval.distance_m else 0.0)
            
            block = IntervalBlock(
                start_time=current_time,
                end_time=current_time + duration,
                type=p_interval.type,
                detection_source=DetectionSource.PLAN
            )
            projected.append(block)
            current_time += duration
            
        return projected

class ElasticMatcher:
    """
    Aligns projected blocks with actual events by shifting or scaling.
    """
    def __init__(self, blocks: List[IntervalBlock]):
        self.blocks = [b.model_copy() for b in blocks]

    def apply_shift(self, seconds: float) -> List[IntervalBlock]:
        for block in self.blocks:
            block.start_time += seconds
            block.end_time += seconds
        return self.blocks

    def scale_block(self, index: int, new_duration: float) -> List[IntervalBlock]:
        if index < 0 or index >= len(self.blocks):
            return self.blocks
        diff = new_duration - self.blocks[index].duration
        self.blocks[index].end_time += diff
        for i in range(index + 1, len(self.blocks)):
            self.blocks[i].start_time += diff
            self.blocks[i].end_time += diff
        return self.blocks

    def remove_blocks(self, indices: List[int]) -> List[IntervalBlock]:
        indices = sorted(indices, reverse=True)
        for idx in indices:
            if 0 <= idx < len(self.blocks):
                removed_block = self.blocks.pop(idx)
                duration = removed_block.duration
                for i in range(idx, len(self.blocks)):
                    self.blocks[i].start_time -= duration
                    self.blocks[i].end_time -= duration
        return self.blocks

class LapAnalyzer:
    """
    Processes raw laps from activity files.
    """
    def __init__(self, raw_laps: List[Dict[str, Any]], min_duration: float = 5.0, reference_start_time: Optional[datetime] = None, sport: Optional[str] = None):
        self.raw_laps = raw_laps
        self.min_duration = min_duration
        self.reference_start_time = reference_start_time
        self.sport = sport

    def to_blocks(self) -> List[IntervalBlock]:
        blocks = []
        
        # Pre-calculate stats for auto-classification
        speeds = []
        for lap in self.raw_laps:
             s = lap.get("avg_speed", 0)
             if s: speeds.append(s)
        
        threshold_speed = 0
        if speeds:
            threshold_speed = sum(speeds) / len(speeds)

        for lap in self.raw_laps:
            # Use timer_time (active) if available, else elapsed
            duration = lap.get("total_timer_time")
            if duration is None or duration == 0:
                duration = lap.get("total_elapsed_time", 0)
                
            if duration < self.min_duration:
                continue
            
            start_time = lap.get("start_time", 0)
            
            if isinstance(start_time, datetime) and self.reference_start_time:
                try:
                    start_time = (start_time - self.reference_start_time).total_seconds()
                except TypeError:
                    ref = self.reference_start_time
                    if start_time.tzinfo != ref.tzinfo:
                         if ref.tzinfo is None: ref = ref.replace(tzinfo=start_time.tzinfo)
                         else: start_time = start_time.replace(tzinfo=ref.tzinfo)
                    start_time = (start_time - ref).total_seconds()
            
            if not isinstance(start_time, (int, float)):
                 continue 

            raw_type = lap.get("intensity")
            block_type = "active"
            
            if raw_type:
                block_type = self._map_type(raw_type)
            else:
                lap_speed = lap.get("avg_speed", 0)
                if lap_speed < threshold_speed:
                    block_type = "rest"
                else:
                    block_type = "active"

            block = IntervalBlock(
                start_time=start_time,
                end_time=start_time + duration,
                type=block_type,
                detection_source=DetectionSource.LAP
            )
            
            # Map metrics directly from FIT lap summary if available
            block.distance_m = lap.get("total_distance")
            
            # Robust speed extraction: some FIT files have multiple avg_speed fields (one None)
            avg_speed = lap.get("enhanced_avg_speed") or lap.get("avg_speed")
            
            if avg_speed is None and block.distance_m and duration > 0:
                # Fallback: recalculate speed using timer_time (duration)
                avg_speed = block.distance_m / duration
                
            block.avg_speed = avg_speed
            block.avg_power = lap.get("avg_power")
            block.avg_hr = lap.get("avg_heart_rate")
            block.avg_cadence = _normalize_cadence(lap.get("avg_cadence"), self.sport)
            
            blocks.append(block)
        return blocks

    def _map_type(self, raw_type: str) -> str:
        mapping = {"warmup": "warmup", "cooldown": "cooldown", "rest": "rest", "recovery": "rest", "active": "active"}
        return mapping.get(raw_type.lower(), "active")

class AlgoDetector:
    """
    Detects intervals using high-fidelity signal processing (ULTRA V5 logic).
    Uses histogram valley detection for optimal thresholding and raw gradient
    analysis for surgical edge refinement.
    """
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def detect(self) -> List[IntervalBlock]:
        if self.df.empty: return []
        signal_col = "power" if "power" in self.df.columns and self.df["power"].max() > 100 else "speed"
        if signal_col not in self.df.columns:
            start_t = self.df["time"].min() if "time" in self.df.columns else 0
            end_t = self.df["time"].max() if "time" in self.df.columns else 0
            return [IntervalBlock(start_time=start_t, end_time=end_t, type="active", detection_source=DetectionSource.ALGO)]
            
        signal = self.df[signal_col].fillna(0)
        
        # 1. Histogram-based optimal threshold (Valley Detection)
        # Smooth for level detection (15s window)
        s_mid = signal.rolling(window=15, center=True).mean().fillna(signal)
        
        # Filter out zero/near-zero to find moving levels
        non_zero = s_mid[s_mid > s_mid.max() * 0.1]
        if non_zero.empty: non_zero = s_mid
        
        # Find peaks in histogram to identify 'Rest' and 'Work' levels
        hist, bins = np.histogram(non_zero, bins=40)
        bin_centers = (bins[:-1] + bins[1:]) / 2
        
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(hist, distance=3, height=len(non_zero)*0.03)
        
        if len(peaks) >= 2:
            sorted_peaks = sorted(peaks)
            p_rest = sorted_peaks[0]
            p_work = sorted_peaks[-1]
            # Threshold is the deepest valley between rest and work peaks
            valley_idx = np.argmin(hist[p_rest:p_work]) + p_rest
            threshold_high = bin_centers[valley_idx]
            # Low threshold for hysteresis (recovery level + 50% of gap)
            threshold_low = bin_centers[p_rest] + (threshold_high - bin_centers[p_rest]) * 0.5
        else:
            # Fallback to adaptive quantiles if signal is unimodal (e.g. constant tempo)
            threshold_high = non_zero.quantile(0.70)
            threshold_low = non_zero.quantile(0.50)
            
        # 2. Hysteresis Thresholding for stability
        is_active = pd.Series(False, index=self.df.index)
        currently_active = False
        for i in range(len(s_mid)):
            val = s_mid.iloc[i]
            if not currently_active and val > threshold_high:
                currently_active = True
            elif currently_active and val < threshold_low:
                currently_active = False
            is_active.iloc[i] = currently_active
            
        # 3. Clean Spikes/Gaps
        # Merge gaps < 10s and remove spikes < 15s
        is_active = is_active.rolling(window=10, center=True).max().fillna(is_active).astype(bool)
        is_active = is_active.rolling(window=15, center=True).min().fillna(is_active).astype(bool)
        
        diff = is_active.astype(int).diff().fillna(0)
        
        # Ensure 'time' column exists for block creation
        time_col = "time"
        if "time" not in self.df.columns:
             start_ts = self.df.index[0] if isinstance(self.df.index, pd.DatetimeIndex) else 0
             if isinstance(start_ts, pd.Timestamp):
                 self.df["time"] = (self.df.index - start_ts).total_seconds()
             else:
                 self.df["time"] = self.df.index
        
        starts = self.df.loc[diff == 1, "time"].tolist()
        ends = self.df.loc[diff == -1, "time"].tolist()
        
        if is_active.iloc[0]: starts.insert(0, self.df["time"].iloc[0])
        if is_active.iloc[-1]: ends.append(self.df["time"].iloc[-1])
        
        # 4. Surgical Edge Refinement using Raw Gradient
        # We look for the absolute sharpest transition in a +/- 20s window
        raw_smooth = signal.rolling(window=2, center=True).mean().fillna(signal)
        raw_grad = np.gradient(raw_smooth.values)
        grad_series = pd.Series(raw_grad, index=self.df.index)
        
        raw_intervals = []
        for s_t, e_t in zip(starts, ends):
            # Convert time to index/timestamp for slicing
            s_idx = self.df[self.df["time"] == s_t].index[0]
            e_idx = self.df[self.df["time"] == e_t].index[0]
            
            # Start Refinement
            s_win = grad_series.loc[s_idx - pd.Timedelta(seconds=20) : s_idx + pd.Timedelta(seconds=20)] if isinstance(s_idx, pd.Timestamp) else grad_series.iloc[int(max(0, s_t-20)):int(min(len(grad_series), s_t+20))]
            if not s_win.empty:
                best_s_idx = s_win.idxmax()
                s_t = self.df.loc[best_s_idx, "time"] if "time" in self.df.columns else best_s_idx
                
            # End Refinement
            e_win = grad_series.loc[e_idx - pd.Timedelta(seconds=20) : e_idx + pd.Timedelta(seconds=20)] if isinstance(e_idx, pd.Timestamp) else grad_series.iloc[int(max(0, e_t-20)):int(min(len(grad_series), e_t+20))]
            if not e_win.empty:
                best_e_idx = e_win.idxmin()
                e_t = self.df.loc[best_e_idx, "time"] if "time" in self.df.columns else best_e_idx
            
            if e_t - s_t >= 15:
                raw_intervals.append((s_t, e_t))
        
        # 5. Smart Filtering (Main Set Selection)
        if len(raw_intervals) > 3:
            durs = [e - s for s, e in raw_intervals]
            median_dur = np.median(durs)
            final_intervals = []
            for s, e in raw_intervals:
                dur = e - s
                if dur > 300 or (0.5 * median_dur <= dur <= 1.5 * median_dur):
                    final_intervals.append((s, e))
        else:
            final_intervals = raw_intervals
            
        # 6. Create IntervalBlocks
        blocks = []
        last_end = self.df["time"].iloc[0]
        
        for s, e in final_intervals:
            if s > last_end + 1:
                 blocks.append(IntervalBlock(start_time=last_end, end_time=s, type="rest", detection_source=DetectionSource.ALGO))
            blocks.append(IntervalBlock(start_time=s, end_time=e, type="active", detection_source=DetectionSource.ALGO))
            last_end = e
            
        if last_end < self.df["time"].max():
            blocks.append(IntervalBlock(start_time=last_end, end_time=self.df["time"].max(), type="rest", detection_source=DetectionSource.ALGO))
            
        return blocks

class EnsembleVoter:
    """
    Fuses Plan, Laps, and Algo data into a single truth.
    """
    def __init__(self, plan_blocks: List[IntervalBlock], lap_blocks: List[IntervalBlock], algo_blocks: List[IntervalBlock]):
        self.plan_blocks = plan_blocks
        self.lap_blocks = lap_blocks
        self.algo_blocks = algo_blocks
        self.audit_log = []

    def fuse(self) -> List[IntervalBlock]:
        if not self.plan_blocks:
            if self.lap_blocks: 
                self.audit_log.append("No plan. Using Laps as primary source.")
                return self.lap_blocks
            self.audit_log.append("No plan or laps. Using Algo as fallback.")
            return self.algo_blocks
            
        # Aligner le plan sur le premier lap significatif ou le premier bloc algo
        shift = 0.0
        if self.lap_blocks:
            shift = self.lap_blocks[0].start_time - self.plan_blocks[0].start_time
            self.audit_log.append(f"Aligning plan with first Lap (Shift: {shift:.1f}s)")
        elif self.algo_blocks:
            shift = self.algo_blocks[0].start_time - self.plan_blocks[0].start_time
            self.audit_log.append(f"Aligning plan with first Algo block (Shift: {shift:.1f}s)")
            
        matcher = ElasticMatcher(self.plan_blocks)
        matcher.apply_shift(shift)
        
        fused_blocks = matcher.blocks
        for i, block in enumerate(fused_blocks):
            matching_lap = self._find_matching(block, self.lap_blocks)
            if matching_lap:
                block.start_time = matching_lap.start_time
                block.end_time = matching_lap.end_time
                # Copy metrics from Lap source
                block.avg_speed = matching_lap.avg_speed
                block.avg_power = matching_lap.avg_power
                block.avg_hr = matching_lap.avg_hr
                block.avg_cadence = matching_lap.avg_cadence
                self.audit_log.append(f"Block {i+1} ({block.type}): Adjusted via LAP")
                continue
                
            matching_algo = self._find_matching(block, self.algo_blocks)
            if matching_algo:
                block.start_time = matching_algo.start_time
                block.end_time = matching_algo.end_time
                # Algo blocks usually don't have pre-calculated metrics, 
                # but we copy if present
                block.avg_speed = matching_algo.avg_speed
                block.avg_power = matching_algo.avg_power
                block.avg_hr = matching_algo.avg_hr
                block.avg_cadence = matching_algo.avg_cadence
                self.audit_log.append(f"Block {i+1} ({block.type}): Adjusted via ALGO")
            else:
                self.audit_log.append(f"Block {i+1} ({block.type}): Kept theoretical PLAN")
                
        return fused_blocks

    def _find_matching(self, target: IntervalBlock, candidates: List[IntervalBlock], tolerance: float = 30.0) -> Optional[IntervalBlock]:
        for c in candidates:
            if abs(c.start_time - target.start_time) < tolerance:
                return c
        return None

class IntervalMetricsCalculator:
    """
    Calculates physiological metrics for a given interval block.
    """
    def __init__(self, streams: pd.DataFrame, sport: Optional[str] = None):
        self.streams = streams
        self.sport = sport
        # Ensure time column exists for slicing
        if "time" not in self.streams.columns:
             start_time = self.streams.index[0] if isinstance(self.streams.index, pd.DatetimeIndex) else 0
             if isinstance(start_time, pd.Timestamp):
                 self.streams["time"] = (self.streams.index - start_time).total_seconds()
             else:
                 self.streams["time"] = self.streams.index

    def calculate(self, block: IntervalBlock) -> IntervalBlock:
        """
        Computes Avg Power, HR, Speed, Cadence for the block duration.
        Only calculates if values are currently None.
        """
        # Slice streams
        mask = (self.streams["time"] >= block.start_time) & (self.streams["time"] <= block.end_time)
        segment = self.streams.loc[mask]
        
        if segment.empty:
            return block
            
        # Calculate averages only if missing
        if block.distance_m is None and "distance" in segment.columns:
            block.distance_m = float(segment["distance"].iloc[-1] - segment["distance"].iloc[0])
        if block.avg_power is None and "power" in segment.columns:
            # Karoly 2026-02-02: Wmoy excludes zeros
            pwr = segment["power"].dropna()
            block.avg_power = float(pwr[pwr > 0].mean()) if not pwr.empty else None
        if block.avg_hr is None and "heart_rate" in segment.columns:
            block.avg_hr = float(segment["heart_rate"].mean())
        if block.avg_speed is None and "speed" in segment.columns:
            block.avg_speed = float(segment["speed"].mean())
        if block.avg_cadence is None and "cadence" in segment.columns:
            block.avg_cadence = _normalize_cadence(segment["cadence"].mean(), self.sport)
            
        # Calculate Efficiency Ratio (Pa:Hr)
        if block.avg_hr and block.avg_hr > 0:
            if block.avg_power is not None:
                block.pa_hr_ratio = block.avg_power / block.avg_hr
            elif block.avg_speed is not None:
                # Speed based efficiency
                block.pa_hr_ratio = block.avg_speed / block.avg_hr
            
        # Calculate Decoupling (if duration > 60s)
        duration = block.end_time - block.start_time
        if duration > 60 and not segment.empty and "heart_rate" in segment.columns:
            mid = block.start_time + (duration / 2)
            first_half = segment[segment["time"] < mid]
            second_half = segment[segment["time"] >= mid]
            
            # Karoly 2026-02-02: Wmoy excludes zeros
            if "power" in first_half.columns:
                p1_s = first_half["power"].dropna()
                p1 = p1_s[p1_s > 0].mean() if not p1_s.empty else None
                p2_s = second_half["power"].dropna()
                p2 = p2_s[p2_s > 0].mean() if not p2_s.empty else None
            else:
                p1, p2 = None, None
            
            h1 = first_half["heart_rate"].mean()
            h2 = second_half["heart_rate"].mean()
            
            if h1 and h2 and h1 > 0 and h2 > 0:
                # Prioritize Power
                if p1 is not None and p2 is not None:
                    r1 = p1 / h1
                    r2 = p2 / h2
                    block.decoupling = (r1 - r2) / r1 if r1 != 0 else 0
                elif "speed" in first_half.columns:
                    # Fallback Speed
                    s1 = first_half["speed"].mean()
                    s2 = second_half["speed"].mean()
                    r1 = s1 / h1
                    r2 = s2 / h2
                    block.decoupling = (r1 - r2) / r1 if r1 != 0 else 0
            
        return block
