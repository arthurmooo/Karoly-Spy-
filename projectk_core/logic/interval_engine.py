from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime
from projectk_core.logic.models import PlannedStructure, IntervalBlock, DetectionSource

class IntervalEngine:
    """
    Core engine for high-precision interval detection.
    
    Fusion Strategy:
    1. Plan Correlation (Priority 1)
    2. Lap Analysis (Priority 2)
    3. Algorithmic Detection (Priority 3)
    """
    def __init__(self, plan: Optional[PlannedStructure] = None, raw_laps: Optional[List[Dict[str, Any]]] = None, streams: Optional[pd.DataFrame] = None, workout_start_time: Optional[datetime] = None):
        self.plan = plan
        self.raw_laps = raw_laps
        self.streams = streams
        self.workout_start_time = workout_start_time

    def process(self) -> List[IntervalBlock]:
        """
        Execute the full fusion pipeline.
        """
        plan_blocks = PlanProjector(self.plan).project() if self.plan else []
        lap_blocks = LapAnalyzer(self.raw_laps, reference_start_time=self.workout_start_time).to_blocks() if self.raw_laps else []
        algo_blocks = AlgoDetector(self.streams).detect() if self.streams is not None else []
        
        voter = EnsembleVoter(plan_blocks, lap_blocks, algo_blocks)
        fused_blocks = voter.fuse()
        
        # Calculate metrics for fused blocks
        if self.streams is not None:
            calculator = IntervalMetricsCalculator(self.streams)
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
    def __init__(self, raw_laps: List[Dict[str, Any]], min_duration: float = 5.0, reference_start_time: Optional[datetime] = None):
        self.raw_laps = raw_laps
        self.min_duration = min_duration
        self.reference_start_time = reference_start_time

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
                start_time = (start_time - self.reference_start_time).total_seconds()
            
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
            block.avg_speed = lap.get("avg_speed") or lap.get("enhanced_avg_speed")
            block.avg_power = lap.get("avg_power")
            block.avg_hr = lap.get("avg_heart_rate")
            block.avg_cadence = lap.get("avg_cadence")
            
            blocks.append(block)
        return blocks

    def _map_type(self, raw_type: str) -> str:
        mapping = {"warmup": "warmup", "cooldown": "cooldown", "rest": "rest", "recovery": "rest", "active": "active"}
        return mapping.get(raw_type.lower(), "active")

class AlgoDetector:
    """
    Detects intervals using signal processing (Power/Speed).
    """
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def detect(self) -> List[IntervalBlock]:
        if self.df.empty: return []
        signal_col = "power" if "power" in self.df.columns else "speed"
        if signal_col not in self.df.columns:
            return [IntervalBlock(start_time=self.df["time"].min(), end_time=self.df["time"].max(), type="active", detection_source=DetectionSource.ALGO)]
            
        signal = self.df[signal_col].fillna(0)
        
        # Smooth signal (10s)
        signal_smooth = signal.rolling(window=10, center=True).mean().fillna(signal)
        
        s_min, s_max = signal_smooth.min(), signal_smooth.max()
        s_range = s_max - s_min
        if s_range < 5:
             return [IntervalBlock(start_time=self.df["time"].min(), end_time=self.df["time"].max(), type="active", detection_source=DetectionSource.ALGO)]
            
        # K-Means (3 Clusters) Logic for robust thresholding
        values = signal_smooth.values
        v_min = values.min()
        v_max = values.max()
        v_med = np.median(values)
        
        c_low = v_min
        c_med = v_med
        c_high = v_max
        
        for _ in range(5):
            d_low = abs(values - c_low)
            d_med = abs(values - c_med)
            d_high = abs(values - c_high)
            
            # Assign to nearest
            labels = np.argmin(np.vstack((d_low, d_med, d_high)), axis=0)
            
            # Update
            if (labels==0).any(): c_low = values[labels==0].mean()
            if (labels==1).any(): c_med = values[labels==1].mean()
            if (labels==2).any(): c_high = values[labels==2].mean()
        
        # Threshold between Med and High (Rest vs Active)
        threshold = (c_med + c_high) / 2
             
        is_active = signal_smooth > threshold
        diff = is_active.astype(int).diff().fillna(0)
        starts = self.df.loc[diff == 1, "time"].tolist()
        ends = self.df.loc[diff == -1, "time"].tolist()
        if is_active.iloc[0]: starts.insert(0, self.df["time"].iloc[0])
        if is_active.iloc[-1]: ends.append(self.df["time"].iloc[-1])
            
        # Collect raw intervals
        raw_intervals = []
        for s, e in zip(starts, ends):
            raw_intervals.append((s, e))
            
        # Merge close intervals (gap < 20s)
        if not raw_intervals:
            return []
            
        merged_intervals = []
        current_s, current_e = raw_intervals[0]
        
        for next_s, next_e in raw_intervals[1:]:
            if next_s - current_e < 20: 
                current_e = next_e
            else:
                merged_intervals.append((current_s, current_e))
                current_s, current_e = next_s, next_e
        merged_intervals.append((current_s, current_e))
        
        # Filter short blocks (noise < 15s)
        final_intervals = []
        for s, e in merged_intervals:
            if e - s >= 15:
                final_intervals.append((s, e))
        
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

    def fuse(self) -> List[IntervalBlock]:
        if not self.plan_blocks:
            if self.lap_blocks: return self.lap_blocks
            return self.algo_blocks
            
        # Aligner le plan sur le premier lap significatif ou le premier bloc algo
        shift = 0.0
        if self.lap_blocks:
            shift = self.lap_blocks[0].start_time - self.plan_blocks[0].start_time
        elif self.algo_blocks:
            shift = self.algo_blocks[0].start_time - self.plan_blocks[0].start_time
            
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
    def __init__(self, streams: pd.DataFrame):
        self.streams = streams
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
        if block.avg_power is None and "power" in segment.columns:
            block.avg_power = float(segment["power"].mean())
        if block.avg_hr is None and "heart_rate" in segment.columns:
            block.avg_hr = float(segment["heart_rate"].mean())
        if block.avg_speed is None and "speed" in segment.columns:
            block.avg_speed = float(segment["speed"].mean())
        if block.avg_cadence is None and "cadence" in segment.columns:
            block.avg_cadence = float(segment["cadence"].mean())
            
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
            
            p1 = first_half["power"].mean() if "power" in first_half.columns else None
            h1 = first_half["heart_rate"].mean()
            
            p2 = second_half["power"].mean() if "power" in second_half.columns else None
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
