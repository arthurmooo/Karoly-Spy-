
from typing import Dict, Any, Optional

class LapCalculator:
    """
    Utility to recalculate lap metrics ensuring consistency with Nolio/Strava logic.
    Prioritizes Moving Time (Timer Time) over Elapsed Time for performance metrics.
    """

    @staticmethod
    def recalculate(lap_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recalculates metrics for a single lap.
        
        Args:
            lap_data: Dictionary containing raw FIT lap data.
            
        Returns:
            Dictionary with cleaned/recalculated metrics:
            - calculated_speed (m/s)
            - effective_duration (s)
            - is_clean (bool): True if no significant pause detected
        """
        elapsed = lap_data.get('total_elapsed_time') or 0.0
        timer = lap_data.get('total_timer_time')
        
        # If timer is None (not present), use elapsed. 
        # If timer is 0.0, it might be a real 0s lap or missing. 
        # Typically we trust explicit 0.0 if key exists, but for safety:
        if timer is None:
            effective_duration = float(elapsed)
        else:
            effective_duration = float(timer)
            
        distance = float(lap_data.get('total_distance') or 0.0)
        
        # Calculate Speed
        if effective_duration > 0:
            calc_speed = distance / effective_duration
        else:
            calc_speed = 0.0
            
        # Check for discrepancies (Pause Detection)
        # If elapsed is significantly > timer (> 5% difference and > 5s diff)
        is_clean = True
        if elapsed > 0 and (elapsed - effective_duration) > 5.0:
            if effective_duration / elapsed < 0.95:
                is_clean = False
                
        return {
            'calculated_speed': calc_speed,
            'effective_duration': effective_duration,
            'is_clean': is_clean,
            'original_elapsed': elapsed,
            'original_timer': timer if timer is not None else -1
        }
