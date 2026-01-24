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
            
            if duration == 0.0 and p_interval.type != "rest":
                # If truly 0 and not rest, we might have an issue, but let's allow it for now
                # or skip.
                pass

            block = IntervalBlock(
                start_time=current_time,
                end_time=current_time + duration,
                type=p_interval.type,
                detection_source=DetectionSource.PLAN
            )
            projected.append(block)
            current_time += duration
            
        return projected