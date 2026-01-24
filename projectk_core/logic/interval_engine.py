from typing import List, Optional
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
