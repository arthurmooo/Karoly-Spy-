import pandas as pd
import numpy as np

class IntervalAuditor:
    def __init__(self, activity):
        """
        Args:
            activity: An Activity object (must have .df and .sport attributes)
        """
        self.activity = activity
        self.df = activity.df

    def audit(self, intervals):
        """
        Computes detailed metrics for each interval.
        
        Args:
            intervals: List of dicts with 'start_time' and 'end_time' (timestamps).
            
        Returns:
            List of dicts with computed metrics.
        """
        report = []
        
        for i, interval in enumerate(intervals):
            start = interval['start_time']
            end = interval['end_time']
            
            # Slice dataframe
            # Use strict slicing or include/exclude boundaries? Typically inclusive
            segment = self.df[(self.df.index >= start) & (self.df.index <= end)]
            
            if segment.empty:
                # Handle empty segment (e.g. out of bounds)
                report.append({
                    "interval_index": i,
                    "error": "No data found for interval"
                })
                continue

            duration = (end - start).total_seconds()
            
            stats = {
                "interval_index": i,
                "start_time": start,
                "end_time": end,
                "duration_sec": duration,
                "data_points": len(segment)
            }
            
            # HR
            if "heart_rate" in segment.columns:
                stats["avg_hr"] = segment["heart_rate"].mean()
                
            # Sport specific
            is_run = self.activity.sport in ["Running", "Trail Running"]
            is_bike = self.activity.sport in ["Cycling", "Virtual Cycling", "Mountain Biking"]
            
            # Default fallback if sport string is different or fuzzy
            if not is_run and not is_bike:
                # Try to guess or include both if available?
                # Spec says: "Avg Speed (pour Run) OU Avg Power (pour Bike)."
                # Let's check columns availability
                if "speed" in segment.columns:
                    stats["avg_speed"] = segment["speed"].mean()
                if "power" in segment.columns:
                    stats["avg_power"] = segment["power"].mean()
            
            else:
                if is_run and "speed" in segment.columns:
                    stats["avg_speed"] = segment["speed"].mean()
                if is_bike and "power" in segment.columns:
                    stats["avg_power"] = segment["power"].mean()
                    
            report.append(stats)
            
        return report
