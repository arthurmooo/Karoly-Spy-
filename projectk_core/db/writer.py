from typing import Dict, Any, Optional, List
import pandas as pd
import numpy as np
from pydantic import BaseModel
from projectk_core.logic.models import Activity
from projectk_core.processing.stream_sampler import downsample_streams, serialize_laps

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
        # Karoly 2026-02-02: For Bike (and general power display), use mean excluding zeros (Nolio's Wmoy)
        if not df.empty and 'power' in df.columns:
            pwr_series = df['power'].dropna()
            avg_power = float(pwr_series[pwr_series > 0].mean()) if not pwr_series.empty else None
        else:
            avg_power = None
            
        avg_hr = float(df['heart_rate'].mean()) if not df.empty and 'heart_rate' in df.columns else None

        # Weather Logic: Metadata (API) takes priority over streams (Device)
        temp_avg = meta.temp_avg
        humidity_avg = meta.humidity_avg
        weather_source = meta.weather_source
        
        if temp_avg is None and not df.empty and 'temperature' in df.columns:
            temp_avg = float(df['temperature'].mean())
            weather_source = "device"
            
        sport = meta.activity_type

        # Construct record
        record = {
            "athlete_id": athlete_id,
            "nolio_id": nolio_id,
            "activity_name": meta.activity_name,
            "session_date": meta.start_time.isoformat(),
            "sport_type": meta.activity_type,
            "source_sport": meta.source_sport,
            "duration_sec": meta.duration_sec,
            "moving_time_sec": meta.moving_time_sec,
            "distance_m": meta.distance_m,
            "rpe": int(meta.rpe) if meta.rpe is not None else None,
            "missing_rpe_flag": meta.rpe is None,
            "work_type": meta.work_type,
            "elevation_gain": meta.elevation_gain,
            
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
            "interval_pace_last": metrics_dict.get("interval_pace_last"),
            "interval_pace_mean": metrics_dict.get("interval_pace_mean"),
            "interval_respect_score": metrics_dict.get("interval_respect_score"),
            "interval_detection_source": metrics_dict.get("interval_detection_source"),
            
            # Smart Segmentation (New JSONB column)
            # Inject new interval efficiency metrics here to avoid DB migration
            "segmented_metrics": {
                **(metrics_dict.get("segmented_metrics").model_dump() if hasattr(metrics_dict.get("segmented_metrics"), "model_dump") else (metrics_dict.get("segmented_metrics") or {})),
                "interval_pahr_mean": metrics_dict.get("interval_pahr_mean"),
                "interval_pahr_last": metrics_dict.get("interval_pahr_last"),
                "interval_blocks": metrics_dict.get("interval_blocks") or []
            },
            
            # Averages
            "avg_power": avg_power,
            "avg_hr": avg_hr,
            
            # File Info
            "fit_file_path": file_path,
            "fit_file_hash": file_hash,
            "source_json": meta.source_json,
            "athlete_comment": meta.source_json.get("description") if meta.source_json else None,

            # Streams (downsampled 5s, pauses excluded) & Garmin Laps
            "activity_streams": downsample_streams(df, interval_sec=5, sport=sport, exclude_pauses=True) if not df.empty and 'heart_rate' in df.columns else None,
            "garmin_laps": serialize_laps(activity.laps, meta.start_time, sport=sport) if activity.laps else None,
        }
        
        # DEBUG WEATHER
        if record['weather_source'] == 'openweathermap':
            print(f"      [cyan]🚀 DB PREP: Sending weather -> {record['temp_avg']} / {record['humidity_avg']} source: {record['weather_source']}[/cyan]")
        
        # Sanitize NaNs recursively to None for JSON/SQL compatibility
        record = ActivityWriter._sanitize_recursive(record)
        print(f"      📝 DEBUG: Saving Nolio:{nolio_id} Sport:{record['sport_type']} Source:{record['source_sport']}")
        return record

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
        result = db_connector.client.table('activities').upsert(data, on_conflict='nolio_id').execute()
        
        # Save intervals if any
        if hasattr(activity, 'intervals') and activity.intervals:
            # We need the activity_id (primary key) from the upsert result
            if result.data:
                db_activity_id = result.data[0]['id']
                ActivityWriter.save_intervals(activity.intervals, db_activity_id, db_connector)
        
        return result

    @staticmethod
    def save_intervals(intervals: List[Any], activity_id: str, db_connector):
        """
        Saves a list of detected intervals to activity_intervals table.
        Deletes existing ones first for this activity.
        """
        if not intervals:
            return
            
        # 1. Clean up old intervals for this activity (Robustness for re-ingestion)
        db_connector.client.table('activity_intervals').delete().eq('activity_id', activity_id).execute()
        
        # 2. Prepare and Insert
        data_to_save = []
        for block in intervals:
            # block is an IntervalBlock (Pydantic)
            row = {
                "activity_id": activity_id,
                "start_time": block.start_time,
                "end_time": block.end_time,
                "duration": block.duration,
                "type": block.type,
                "detection_source": block.detection_source.value,
                "avg_speed": block.avg_speed,
                "avg_power": block.avg_power,
                "avg_hr": block.avg_hr,
                "avg_cadence": block.avg_cadence,
                "pa_hr_ratio": block.pa_hr_ratio,
                "decoupling": block.decoupling
            }
            data_to_save.append(ActivityWriter._sanitize_recursive(row))
            
        if data_to_save:
            return db_connector.client.table('activity_intervals').insert(data_to_save).execute()

    @staticmethod
    def save_interval_dicts(interval_dicts: list, activity_id: str, db_connector):
        """
        Saves raw interval matcher dicts to activity_intervals table.
        Deletes existing rows first. Used by the reprocessor path
        (which doesn't go through save() / IntervalBlock Pydantic objects).
        """
        # Always clean up old intervals for this activity
        db_connector.client.table('activity_intervals').delete().eq('activity_id', activity_id).execute()

        if not interval_dicts:
            return

        data_to_save = []
        for m in interval_dicts:
            if m.get('status') != 'matched':
                continue
            row = {
                "activity_id": activity_id,
                "start_time": float(m.get('start_index', 0)),
                "end_time": float(m.get('end_index', 0)),
                "duration": float(m.get('duration_sec', 0)),
                "type": "active",
                "detection_source": m.get('source', 'unknown'),
                "avg_speed": float(m['avg_speed']) if m.get('avg_speed') else None,
                "avg_power": float(m.get('plateau_avg_power') or m.get('avg_power') or 0) or None,
                "avg_hr": float(m['avg_hr']) if m.get('avg_hr') else None,
                "avg_cadence": float(m['avg_cadence']) if m.get('avg_cadence') else None,
                "pa_hr_ratio": None,
                "decoupling": None,
                "respect_score": float(m['respect_score']) if m.get('respect_score') else None,
            }
            data_to_save.append(ActivityWriter._sanitize_recursive(row))

        if data_to_save:
            return db_connector.client.table('activity_intervals').insert(data_to_save).execute()

    @staticmethod
    def update_by_id(db_id: str, activity: Activity, db_connector, athlete_id: str, **kwargs):
        """
        Updates a specific record by its primary key.
        """
        data = ActivityWriter.serialize(activity, athlete_id, **kwargs)
        # Remove primary key and unique constraint fields from update to be safe
        data.pop('id', None)
        return db_connector.client.table('activities').update(data).eq('id', db_id).execute()
