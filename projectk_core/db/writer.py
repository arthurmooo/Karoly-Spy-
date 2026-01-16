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

        # Weather Logic: Metadata (API) takes priority over streams (Device)
        temp_avg = meta.temp_avg
        humidity_avg = meta.humidity_avg
        weather_source = meta.weather_source
        
        if temp_avg is None and not df.empty and 'temperature' in df.columns:
            temp_avg = float(df['temperature'].mean())
            weather_source = "device"
            
        # Construct record
        record = {
            "athlete_id": athlete_id,
            "nolio_id": nolio_id,
            "session_date": meta.start_time.isoformat(),
            "sport_type": meta.activity_type,
            "rpe": int(meta.rpe) if meta.rpe is not None else None,
            "missing_rpe_flag": meta.rpe is None,
            "work_type": meta.work_type,
            
            # Weather
            "temp_avg": temp_avg,
            "humidity_avg": humidity_avg,
            "weather_source": weather_source,
            
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
        
        # DEBUG WEATHER
        if record['weather_source'] == 'openweathermap':
            print(f"      [cyan]🚀 DB PREP: Sending weather -> {record['temp_avg']} / {record['humidity_avg']} source: {record['weather_source']}[/cyan]")
        
        # Sanitize NaNs recursively to None for JSON/SQL compatibility
        return ActivityWriter._sanitize_recursive(record)

    @staticmethod
    def _sanitize_recursive(data: Any) -> Any:
        """
        Recursively replaces NaN with None in dicts and lists.
        """
        if isinstance(data, dict):
            return {k: ActivityWriter._sanitize_recursive(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [ActivityWriter._sanitize_recursive(v) for v in data]
        elif isinstance(data, float) and np.isnan(data):
            return None
        else:
            return data

    @staticmethod
    def save(activity: Activity, db_connector, athlete_id: str, **kwargs):
        """
        Directly saves/upserts to Supabase.
        """
        data = ActivityWriter.serialize(activity, athlete_id, **kwargs)
        return db_connector.client.table('activities').upsert(data, on_conflict='nolio_id').execute()

    @staticmethod
    def update_by_id(db_id: str, activity: Activity, db_connector, athlete_id: str, **kwargs):
        """
        Updates a specific record by its primary key.
        """
        data = ActivityWriter.serialize(activity, athlete_id, **kwargs)
        # Remove primary key and unique constraint fields from update to be safe
        data.pop('id', None)
        return db_connector.client.table('activities').update(data).eq('id', db_id).execute()
