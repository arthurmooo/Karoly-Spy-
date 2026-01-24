from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from projectk_core.logic.models import PlannedStructure, IntervalBlock, DetectionSource

class IntervalEngine:
    """
    Core engine for high-precision interval detection.
    
    Fusion Strategy:
    1. Plan Correlation (Priority 1)
    2. Lap Analysis (Priority 2)
    3. Algorithmic Detection (Priority 3)
    """
    def __init__(self):
        pass

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
            # If duration is missing but distance is present, we use a dummy duration (1s)
            # to avoid validation errors, until we have speed data.
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
        """
        Apply a constant time shift to all blocks.
        """
        for block in self.blocks:
            block.start_time += seconds
            block.end_time += seconds
        return self.blocks

    def scale_block(self, index: int, new_duration: float) -> List[IntervalBlock]:
        """
        Adjust the duration of a specific block and shift subsequent blocks.
        """
        if index < 0 or index >= len(self.blocks):
            return self.blocks
            
        old_duration = self.blocks[index].duration
        diff = new_duration - old_duration
        
        self.blocks[index].end_time += diff
        
        # Shift all subsequent blocks
        for i in range(index + 1, len(self.blocks)):
            self.blocks[i].start_time += diff
            self.blocks[i].end_time += diff
            
        return self.blocks

    def remove_blocks(self, indices: List[int]) -> List[IntervalBlock]:
        """
        Remove specified blocks and shift remaining blocks to close gaps.
        """
        indices = sorted(indices, reverse=True)
        for idx in indices:
            if 0 <= idx < len(self.blocks):
                removed_block = self.blocks.pop(idx)
                duration = removed_block.duration
                # Shift subsequent blocks backwards
                for i in range(idx, len(self.blocks)):
                    self.blocks[i].start_time -= duration
                    self.blocks[i].end_time -= duration
        return self.blocks

class LapAnalyzer:
    """
    Processes raw laps from activity files.
    """
    def __init__(self, raw_laps: List[Dict[str, Any]], min_duration: float = 10.0):
        self.raw_laps = raw_laps
        self.min_duration = min_duration

    def to_blocks(self) -> List[IntervalBlock]:
        """
        Convert raw laps to IntervalBlocks, filtering out parasites.
        """
        blocks = []
        for lap in self.raw_laps:
            duration = lap.get("total_elapsed_time", 0)
            if duration < self.min_duration:
                continue
                
            start_time = lap.get("start_time", 0)
            
            # Map intensity to standard types
            raw_type = lap.get("intensity", "active")
            block_type = self._map_type(raw_type)
            
            block = IntervalBlock(
                start_time=start_time,
                end_time=start_time + duration,
                type=block_type,
                detection_source=DetectionSource.LAP
            )
            blocks.append(block)
            
        return blocks

    def _map_type(self, raw_type: str) -> str:
        mapping = {
            "warmup": "warmup",
            "cooldown": "cooldown",
            "rest": "rest",
            "recovery": "rest",
            "active": "active"
        }
        return mapping.get(raw_type.lower(), "active")

class AlgoDetector:
    """
    Detects intervals using signal processing (Power/Speed).
    """
    def __init__(self, df: pd.DataFrame):
        self.df = df

    def detect(self) -> List[IntervalBlock]:
        """
        Detect jumps in power/speed to identify blocks.
        """
        if self.df.empty:
            return []
            
        # Prioritize Power, then Speed
        signal_col = "power" if "power" in self.df.columns else "speed"
        if signal_col not in self.df.columns:
            # Fallback to single block
            return [IntervalBlock(
                start_time=self.df["time"].min(),
                end_time=self.df["time"].max(),
                type="active",
                detection_source=DetectionSource.ALGO
            )]
            
        signal = self.df[signal_col].fillna(0)
        
        # Threshold logic: we want to find "work" vs "rest"
        # If max is high, we can use a relative threshold
        s_min = signal.min()
        s_max = signal.max()
        s_range = s_max - s_min
        
        if s_range < 5: # Not enough variation
             return [IntervalBlock(
                start_time=self.df["time"].min(),
                end_time=self.df["time"].max(),
                type="active",
                detection_source=DetectionSource.ALGO
            )]
            
        threshold = s_min + (s_range * 0.4) # 40% of the range above min
        is_active = signal > threshold
        
        # Detect state changes
        diff = is_active.astype(int).diff().fillna(0)
        starts = self.df.loc[diff == 1, "time"].tolist()
        ends = self.df.loc[diff == -1, "time"].tolist()
        
        # Handle edge cases (starts/ends misalignment)
        if is_active.iloc[0]:
            starts.insert(0, self.df["time"].iloc[0])
        if is_active.iloc[-1]:
            ends.append(self.df["time"].iloc[-1])
            
        blocks = []
        last_end = self.df["time"].iloc[0]
        
        for s, e in zip(starts, ends):
            # Recovery before active
            if s > last_end + 1:
                blocks.append(IntervalBlock(
                    start_time=last_end,
                    end_time=s,
                    type="rest",
                    detection_source=DetectionSource.ALGO
                ))
            
            # Active block
            blocks.append(IntervalBlock(
                start_time=s,
                end_time=e,
                type="active",
                detection_source=DetectionSource.ALGO
            ))
            last_end = e
            
        # Final recovery if needed
        if last_end < self.df["time"].max():
            blocks.append(IntervalBlock(
                start_time=last_end,
                end_time=self.df["time"].max(),
                type="rest",
                detection_source=DetectionSource.ALGO
            ))
            
        if not blocks:
             blocks.append(IntervalBlock(
                start_time=self.df["time"].min(),
                end_time=self.df["time"].max(),
                type="active",
                detection_source=DetectionSource.ALGO
            ))
            
        return blocks
