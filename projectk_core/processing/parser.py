import fitdecode
import pandas as pd
import numpy as np
import os
from typing import Optional, List, Dict

class FitParser:
    """
    Robust parser for .FIT files using fitdecode.
    Handles Garmin, Wahoo, and Coros formats.
    """
    
    # Mapping of FIT fields to internal canonical names
    FIELD_MAPPING = {
        'timestamp': 'timestamp',
        'heart_rate': 'heart_rate',
        'cadence': 'cadence',
        'power': 'power',
        'accumulated_power': 'power_accumulated', # Sometimes power is here
        'enhanced_speed': 'speed',
        'speed': 'speed', # Fallback
        'enhanced_altitude': 'altitude',
        'altitude': 'altitude', # Fallback
        'position_lat': 'lat',
        'position_long': 'lon',
        'temperature': 'temperature',
        'grade': 'grade', # If native
        'distance': 'distance',
        'Effort Pace': 'effort_pace' # Coros specific
    }

    @staticmethod
    def parse(file_path: str) -> tuple[pd.DataFrame, Dict, List[Dict]]:
        """
        Parses a .FIT file and returns:
        1. df_filled: 1Hz resampled DataFrame
        2. metadata: Device info
        3. laps: List of lap summaries (intervals)
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        data = []
        laps = []
        metadata = {
            'serial_number': None,
            'manufacturer': None,
            'product': None
        }
        
        # 1. Read Raw Data & Metadata
        try:
            with fitdecode.FitReader(file_path) as fit:
                for frame in fit:
                    if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                        if frame.name == 'file_id':
                            # DEBUG: Print all file_id fields to see what's available
                            # print(f"DEBUG file_id: {[f.name for f in frame.fields]}")
                            for field in frame.fields:
                                if field.name in metadata:
                                    metadata[field.name] = field.value
                        
                        elif frame.name == 'device_info':
                            # DEBUG: Print all device_info fields
                            # print(f"DEBUG device_info: {[f.name for f in frame.fields]} -> Values: {[f.value for f in frame.fields]}")
                            # Coros/Garmin often put serial number here
                            for field in frame.fields:
                                if field.name == 'serial_number' and metadata['serial_number'] is None:
                                    metadata['serial_number'] = field.value

                        elif frame.name == 'lap':
                            lap_row = {}
                            for field in frame.fields:
                                # We only care about a few fields for interval analysis
                                if field.name in ['start_time', 'total_elapsed_time', 'avg_heart_rate', 'avg_power']:
                                    lap_row[field.name] = field.value
                            if lap_row:
                                laps.append(lap_row)

                        elif frame.name == 'record':
                            row = {}
                            for field in frame.fields:
                                if field.name in FitParser.FIELD_MAPPING:
                                    row[FitParser.FIELD_MAPPING[field.name]] = field.value
                                elif field.name in FitParser.FIELD_MAPPING.values():
                                    row[field.name] = field.value
                            data.append(row)
        except Exception as e:
             raise ValueError(f"Error parsing FIT file: {e}")

        if not data:
            raise ValueError("No 'record' data found in FIT file.")

        df = pd.DataFrame(data)
        
        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        # 2. Resampling to 1Hz
        df = df.set_index('timestamp')
        df = df[~df.index.duplicated(keep='first')]
        df_resampled = df.resample('1s').mean()
        
        # 3. Smart Filling (Gap Handling)
        limit_seconds = 10
        df_filled = df_resampled.interpolate(method='time', limit=limit_seconds)
        df_filled = df_filled.reset_index()
        
        # Ensure numeric types
        numeric_cols = ['heart_rate', 'power', 'speed', 'cadence', 'altitude', 'distance']
        for col in numeric_cols:
            if col in df_filled.columns:
                df_filled[col] = df_filled[col].astype(float)
        
        return df_filled, metadata, laps
