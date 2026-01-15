from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from pydantic import BaseModel
from projectk_core.logic.models import Activity

class ActivityWriter:
    """
    Handles serialization of Activity objects to Database records.
    """
    
    @staticmethod
    def serialize(activity: Activity, athlete_id: str, nolio_id: Optional[str] = None, file_path: Optional[str] = None, file_hash: Optional[str] = None) -> Dict[str, Any]:
        """
        Converts an enriched Activity object into a dictionary matching the 'activities' table schema.
        Handles NaN conversion to None.
        """
        meta = activity.metadata
        metrics = activity.metrics
        
        # Handle Pydantic model
        if isinstance(metrics, BaseModel):
            metrics_dict = metrics.model_dump()
        else:
            metrics_dict = metrics or {}
            
        df = activity.streams
        
        # Calculate raw averages if streams exist
        avg_power = float(df['power'].mean()) if not df.empty and 'power' in df.columns else None
        avg_hr = float(df['heart_rate'].mean()) if not df.empty and 'heart_rate' in df.columns else None
        
        # Temp/Humidity average logic (if present in streams or meta)
        # Assuming temp is in streams usually
        temp_avg = float(df['temperature'].mean()) if not df.empty and 'temperature' in df.columns else None
        
        # Construct record
        record = {
            "athlete_id": athlete_id,
            "nolio_id": nolio_id,
            "session_date": meta.start_time.isoformat(),
            "sport_type": meta.activity_type,
            "rpe": int(meta.rpe) if meta.rpe is not None else None,
            "missing_rpe_flag": meta.rpe is None,
            
            # Weather (Partial implementation for now)
            "temp_avg": temp_avg,
            "humidity_avg": None, # Needs external weather API
            "weather_source": "device" if temp_avg is not None else None,
            
            # Metrics (Karoly)
            "load_index": metrics_dict.get("mls_load"),
            "durability_index": metrics_dict.get("dur_index"),
            "decoupling_index": metrics_dict.get("drift_pahr_percent"),
            
            # Interval Metrics
            "interval_power_last": metrics_dict.get("interval_power_last"),
            "interval_hr_last": metrics_dict.get("interval_hr_last"),
            "interval_power_mean": metrics_dict.get("interval_power_mean"),
            "interval_hr_mean": metrics_dict.get("interval_hr_mean"),
            
            # Smart Segmentation (New JSONB column)
            "segmented_metrics": metrics_dict.get("segmented_metrics"),
            
            # Averages
            "avg_power": avg_power,
            "avg_hr": avg_hr,
            
            # File Info
            "fit_file_path": file_path,
            "fit_file_hash": file_hash
        }
        
        # Sanitize NaNs to None for JSON/SQL compatibility
        return {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in record.items()}

    @staticmethod
    def save(activity: Activity, db_connector, athlete_id: str, **kwargs):
        """
        Directly saves/upserts to Supabase.
        """
        data = ActivityWriter.serialize(activity, athlete_id, **kwargs)
        # Upsert based on nolio_id if present, or just insert?
        # Ideally we use nolio_id as unique constraint or composite key.
        # The schema says nolio_id is unique.
        
        # Note: If nolio_id is None (manual upload), we might create dups if we don't handle ID.
        # For Phase 1, we assume Nolio ingestion mostly.
        
        return db_connector.client.table('activities').upsert(data, on_conflict='nolio_id').execute()
