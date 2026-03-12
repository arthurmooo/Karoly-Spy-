"""
Downsample 1Hz activity streams to compact JSON for DB storage.
Target: ~720 points per hour (5s interval) instead of 3600.
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime


def _normalize_cadence(value: Optional[float], sport: Optional[str] = None) -> Optional[float]:
    if value is None:
        return None
    if sport and sport.lower() == "run":
        return float(value) * 2.0
    return float(value)


def downsample_streams(df: pd.DataFrame, interval_sec: int = 5, sport: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Resample a 1Hz DataFrame to `interval_sec` resolution.
    Returns a list of compact dicts: {t, hr, spd, pwr, cad, alt}
    Keys with None values are omitted to minimize JSON size.
    """
    if df.empty:
        return []

    work = df.copy()

    # Ensure we have a timestamp-based index for resampling
    if 'timestamp' in work.columns:
        work = work.set_index('timestamp')

    if not isinstance(work.index, pd.DatetimeIndex):
        return []

    # Remove duplicate index entries
    work = work[~work.index.duplicated(keep='first')]

    # Compute elapsed seconds from start
    start_ts = work.index[0]

    # Define aggregation rules per column
    agg_rules = {}
    if 'heart_rate' in work.columns:
        agg_rules['heart_rate'] = 'mean'
    if 'speed' in work.columns:
        agg_rules['speed'] = 'last'
    if 'power' in work.columns:
        agg_rules['power'] = 'mean'
    if 'cadence' in work.columns:
        agg_rules['cadence'] = 'mean'
    if 'altitude' in work.columns:
        agg_rules['altitude'] = 'last'

    if not agg_rules:
        return []

    resampled = work.resample(f'{interval_sec}s').agg(agg_rules)

    # Build compact point list
    points: List[Dict[str, Any]] = []
    for ts, row in resampled.iterrows():
        elapsed = int((ts - start_ts).total_seconds())
        point: Dict[str, Any] = {'t': elapsed}

        if 'heart_rate' in row and pd.notna(row['heart_rate']):
            point['hr'] = int(round(row['heart_rate']))
        if 'speed' in row and pd.notna(row['speed']):
            point['spd'] = round(float(row['speed']), 2)
        if 'power' in row and pd.notna(row['power']):
            point['pwr'] = int(round(row['power']))
        if 'cadence' in row and pd.notna(row['cadence']):
            point['cad'] = int(round(_normalize_cadence(row['cadence'], sport) or 0))
        if 'altitude' in row and pd.notna(row['altitude']):
            point['alt'] = round(float(row['altitude']), 1)

        # Skip points with only a timestamp (no useful data)
        if len(point) > 1:
            points.append(point)

    return points


def serialize_laps(laps: List[Dict], start_timestamp: Optional[datetime] = None, sport: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Convert raw Garmin LAP records into compact serializable dicts.
    `start_timestamp` is the activity start time, used to compute relative offsets.
    """
    if not laps:
        return []

    result: List[Dict[str, Any]] = []

    for i, lap in enumerate(laps):
        entry: Dict[str, Any] = {'lap_n': i + 1}

        # Compute start_sec offset from activity start
        lap_start = lap.get('start_time')
        if lap_start and start_timestamp:
            try:
                if hasattr(lap_start, 'timestamp') and hasattr(start_timestamp, 'timestamp'):
                    entry['start_sec'] = round(lap_start.timestamp() - start_timestamp.timestamp(), 1)
                else:
                    delta = lap_start - start_timestamp
                    entry['start_sec'] = round(delta.total_seconds(), 1)
            except Exception:
                entry['start_sec'] = 0
        else:
            entry['start_sec'] = 0

        # Duration
        dur = lap.get('duration') or lap.get('total_elapsed_time') or lap.get('total_timer_time')
        if dur is not None:
            entry['duration_sec'] = round(float(dur), 1)

        # Distance
        dist = lap.get('total_distance')
        if dist is not None:
            entry['distance_m'] = round(float(dist), 1)

        # Avg HR
        avg_hr = lap.get('avg_hr') or lap.get('avg_heart_rate')
        if avg_hr is not None:
            entry['avg_hr'] = int(round(float(avg_hr)))

        # Avg Speed — use enhanced_avg_speed or avg_speed (project convention)
        avg_spd = lap.get('enhanced_avg_speed') or lap.get('avg_speed')
        if avg_spd is not None and float(avg_spd) > 0:
            entry['avg_speed'] = round(float(avg_spd), 3)

        # Avg Power
        avg_pwr = lap.get('avg_power')
        if avg_pwr is not None and float(avg_pwr) > 0:
            entry['avg_power'] = int(round(float(avg_pwr)))

        # Avg Cadence
        avg_cad = lap.get('avg_cadence') or lap.get('cadence')
        normalized_cad = _normalize_cadence(avg_cad, sport)
        if normalized_cad is not None:
            entry['avg_cadence'] = int(round(normalized_cad))

        # Max HR (from stream enrichment or raw lap)
        max_hr = lap.get('max_heart_rate')
        if max_hr is not None:
            entry['max_hr'] = int(round(float(max_hr)))

        # Max Speed
        max_spd = lap.get('enhanced_max_speed') or lap.get('max_speed')
        if max_spd is not None and float(max_spd) > 0:
            entry['max_speed'] = round(float(max_spd), 3)

        result.append(entry)

    return result
