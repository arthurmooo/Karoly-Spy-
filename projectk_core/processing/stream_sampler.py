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


def detect_pause_mask(df: pd.DataFrame, sport: Optional[str] = None) -> np.ndarray:
    """
    Detect pauses in 1Hz stream data.
    Returns a boolean mask (True = paused) of same length as df.

    Thresholds by sport:
    - run/ski/default: speed < 1.5 m/s for >= 20s
    - bike:            speed < 1.0 m/s for >= 20s
    - swim:            speed < 0.25 m/s for >= 20s
    """
    n = len(df)
    if n == 0:
        return np.zeros(0, dtype=bool)

    if 'speed' not in df.columns:
        return np.zeros(n, dtype=bool)

    speed = df['speed'].fillna(0).values

    sport_lower = (sport or "").lower()
    if sport_lower in ("bike", "cycling", "vtt", "vélo"):
        threshold = 1.0
    elif sport_lower in ("swim", "natation"):
        threshold = 0.25
    else:  # run, ski, default
        threshold = 1.5

    min_duration = 20  # seconds

    # Mark all low-speed points
    is_slow = speed < threshold

    # Find consecutive runs of slow points >= min_duration
    mask = np.zeros(n, dtype=bool)
    run_start = None
    for i in range(n):
        if is_slow[i]:
            if run_start is None:
                run_start = i
        else:
            if run_start is not None:
                run_len = i - run_start
                if run_len >= min_duration:
                    mask[run_start:i] = True
                run_start = None
    # Handle trailing run
    if run_start is not None:
        run_len = n - run_start
        if run_len >= min_duration:
            mask[run_start:n] = True

    return mask


def downsample_streams(
    df: pd.DataFrame,
    interval_sec: int = 5,
    sport: Optional[str] = None,
    exclude_pauses: bool = True,
) -> List[Dict[str, Any]]:
    """
    Resample a 1Hz DataFrame to `interval_sec` resolution.
    Returns a list of compact dicts: {t, hr, spd, pwr, cad, alt}
    Keys with None values are omitted to minimize JSON size.

    When exclude_pauses=True, pause segments are filtered out and
    StreamPoint.t represents cumulative active seconds (continuous).
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
    start_ts = work.index[0]

    # Filter pauses if requested
    if exclude_pauses:
        # Reset index temporarily to compute pause mask
        work_reset = work.reset_index()
        pause_mask = detect_pause_mask(work_reset, sport)
        if pause_mask.any():
            work = work[~pause_mask]
            if work.empty:
                return []

    # For pause-filtered data, we compute t as cumulative active seconds
    # instead of clock-based elapsed time
    if exclude_pauses:
        # Each remaining row = 1 active second, so t = 0, 1, 2, ...
        active_seconds = np.arange(len(work))

        # Define aggregation rules per column
        agg_rules = {}
        cols_for_agg = []
        if 'heart_rate' in work.columns:
            agg_rules['heart_rate'] = 'mean'
            cols_for_agg.append('heart_rate')
        if 'speed' in work.columns:
            agg_rules['speed'] = 'last'
            cols_for_agg.append('speed')
        if 'power' in work.columns:
            agg_rules['power'] = 'mean'
            cols_for_agg.append('power')
        if 'cadence' in work.columns:
            agg_rules['cadence'] = 'mean'
            cols_for_agg.append('cadence')
        if 'altitude' in work.columns:
            agg_rules['altitude'] = 'last'
            cols_for_agg.append('altitude')

        if not agg_rules:
            return []

        # Assign bucket based on active seconds
        bucket_ids = active_seconds // interval_sec

        # Reset to a plain DataFrame for groupby
        timestamp_col = work.index.name or 'timestamp'
        work_plain = work.reset_index().rename(columns={timestamp_col: '_timestamp'})
        work_plain['_bucket'] = bucket_ids

        grouped = work_plain.groupby('_bucket')

        points: List[Dict[str, Any]] = []
        for bucket_id, group in grouped:
            elapsed = int(bucket_id * interval_sec)
            point: Dict[str, Any] = {'t': elapsed}
            first_ts = group['_timestamp'].iloc[0]
            point['elapsed_t'] = round(float((first_ts - start_ts).total_seconds()), 1)

            if 'heart_rate' in group.columns:
                hr_val = group['heart_rate'].mean()
                if pd.notna(hr_val):
                    point['hr'] = int(round(hr_val))
            if 'speed' in group.columns:
                spd_val = group['speed'].iloc[-1]
                if pd.notna(spd_val):
                    point['spd'] = round(float(spd_val), 2)
            if 'power' in group.columns:
                pwr_val = group['power'].mean()
                if pd.notna(pwr_val):
                    point['pwr'] = int(round(pwr_val))
            if 'cadence' in group.columns:
                cad_val = group['cadence'].mean()
                if pd.notna(cad_val):
                    point['cad'] = int(round(_normalize_cadence(cad_val, sport) or 0))
            if 'altitude' in group.columns:
                alt_val = group['altitude'].iloc[-1]
                if pd.notna(alt_val):
                    point['alt'] = round(float(alt_val), 1)

            if len(point) > 1:
                points.append(point)

        return points

    # Original clock-based path (exclude_pauses=False)
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

        # Duration — prefer total_timer_time (active time) over total_elapsed_time (clock time)
        dur = lap.get('total_timer_time') or lap.get('total_elapsed_time') or lap.get('duration')
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
