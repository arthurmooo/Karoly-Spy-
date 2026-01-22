from datetime import date, timedelta
from typing import Dict, Any, Optional
import statistics
import logging

log = logging.getLogger(__name__)

class ReadinessCalculator:
    """
    Computes physiological baselines and trends for athletes.
    """
    def __init__(self, db_connector):
        self.db = db_connector

    def calculate_baselines(self, athlete_id: str, reference_date: date) -> Dict[str, Optional[float]]:
        """
        Calculates 30-day rolling averages for RMSSD and Resting HR.
        Returns: { "rmssd_30d_avg": float, "resting_hr_30d_avg": float }
        """
        # Fetch the last 30 entries up to the reference date
        try:
            res = self.db.client.table("daily_readiness")\
                .select("rmssd, resting_hr")\
                .eq("athlete_id", athlete_id)\
                .lte("date", reference_date.isoformat())\
                .order("date", desc=True)\
                .limit(30)\
                .execute()
            
            data = res.data
            if not data:
                return {
                    "rmssd_30d_avg": None,
                    "resting_hr_30d_avg": None
                }
            
            rmssd_values = [d["rmssd"] for d in data if d.get("rmssd") is not None]
            hr_values = [d["resting_hr"] for d in data if d.get("resting_hr") is not None]
            
            return {
                "rmssd_30d_avg": round(statistics.mean(rmssd_values), 1) if rmssd_values else None,
                "resting_hr_30d_avg": round(statistics.mean(hr_values), 1) if hr_values else None
            }
            
        except Exception as e:
            log.error(f"Error calculating readiness baselines for {athlete_id}: {e}")
            return {
                "rmssd_30d_avg": None,
                "resting_hr_30d_avg": None
            }

