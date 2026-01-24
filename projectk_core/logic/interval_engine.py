from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from projectk_core.logic.models import PlannedStructure, IntervalBlock, DetectionSource

from datetime import datetime

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
        return voter.fuse()

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
    def __init__(self, raw_laps: List[Dict[str, Any]], min_duration: float = 10.0, reference_start_time: Optional[datetime] = None):
        self.raw_laps = raw_laps
        self.min_duration = min_duration
        self.reference_start_time = reference_start_time

    def to_blocks(self) -> List[IntervalBlock]:
        blocks = []
        for lap in self.raw_laps:
            # Use timer_time (active) if available, else elapsed
            duration = lap.get("total_timer_time")
            if duration is None or duration == 0:
                duration = lap.get("total_elapsed_time", 0)
                
            if duration < self.min_duration:
                continue
            
            start_time = lap.get("start_time", 0)
            
            # Normalize to relative seconds if start_time is datetime and we have a reference
            if isinstance(start_time, datetime) and self.reference_start_time:
                start_time = (start_time - self.reference_start_time).total_seconds()
            
            if not isinstance(start_time, (int, float)):
                 continue 

            block_type = self._map_type(lap.get("intensity", "active"))
            blocks.append(IntervalBlock(
                start_time=start_time,
                end_time=start_time + duration,
                type=block_type,
                detection_source=DetectionSource.LAP
            ))
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
        
        # Smooth signal to remove noise spikes
        signal_smooth = signal.rolling(window=5, center=True).mean().fillna(signal)
        
        s_min, s_max = signal_smooth.min(), signal_smooth.max()
        s_range = s_max - s_min
        if s_range < 5:
             return [IntervalBlock(start_time=self.df["time"].min(), end_time=self.df["time"].max(), type="active", detection_source=DetectionSource.ALGO)]
            
        # Use Quantile for threshold: 
        # For an interval session, "Active" time is usually less than 50% of total time?
        # Let's try 60th percentile as a dynamic separator.
        # If the athlete pushes hard, intervals are clearly above the median.
        threshold = signal_smooth.quantile(0.6)
        
        # Safety: Ensure threshold is not too close to min (e.g. constant effort)
        if threshold < s_min + (s_range * 0.1):
             threshold = s_min + (s_range * 0.3)
             
        is_active = signal_smooth > threshold
        diff = is_active.astype(int).diff().fillna(0)
        starts = self.df.loc[diff == 1, "time"].tolist()
        ends = self.df.loc[diff == -1, "time"].tolist()
        if is_active.iloc[0]: starts.insert(0, self.df["time"].iloc[0])
        if is_active.iloc[-1]: ends.append(self.df["time"].iloc[-1])
            
        blocks, last_end = [], self.df["time"].iloc[0]
        
        # Filter short blocks (parasites)
        min_duration = 10 # seconds
        
        valid_intervals = []
        # First pass: collect all raw intervals
        current_starts = sorted(starts)
        current_ends = sorted(ends)
        
        # Safe zip
        for s, e in zip(current_starts, current_ends):
            if e - s >= min_duration:
                valid_intervals.append((s, e))
                
        # Build blocks
        for s, e in valid_intervals:
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
        """
        Strategy: 
        - Use Plan for structure (how many blocks, types).
        - Use Laps or Algo to adjust timestamps.
        - Priority: Laps > Algo > Plan.
        """
        if not self.plan_blocks:
            # Fallback to Laps if no plan
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
        
        # Pour chaque bloc du plan, essayer d'ajuster avec un lap ou un bloc algo proche
        fused_blocks = matcher.blocks
        for i, block in enumerate(fused_blocks):
            # Trouver un lap correspondant (même type, temps proche)
            matching_lap = self._find_matching(block, self.lap_blocks)
            if matching_lap:
                block.start_time = matching_lap.start_time
                block.end_time = matching_lap.end_time
                continue
                
            # Sinon, essayer algo
            matching_algo = self._find_matching(block, self.algo_blocks)
            if matching_algo:
                block.start_time = matching_algo.start_time
                block.end_time = matching_algo.end_time
                
        return fused_blocks

    def _find_matching(self, target: IntervalBlock, candidates: List[IntervalBlock], tolerance: float = 30.0) -> Optional[IntervalBlock]:
        for c in candidates:
            # Tolérance temporelle sur le début
            if abs(c.start_time - target.start_time) < tolerance:
                return c
        return None