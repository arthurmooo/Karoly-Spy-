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
        'Effort Pace': 'effort_pace' # Coros specific
    }

    @staticmethod
    def parse(file_path: str) -> pd.DataFrame:
        """
        Parses a .FIT file and returns a clean, 1Hz resampled DataFrame.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        data = []
        
        # 1. Read Raw Data
        try:
            with fitdecode.FitReader(file_path) as fit:
                for frame in fit:
                    if frame.frame_type == fitdecode.FIT_FRAME_DATA and frame.name == 'record':
                        row = {}
                        for field in frame.fields:
                            if field.name in FitParser.FIELD_MAPPING:
                                row[FitParser.FIELD_MAPPING[field.name]] = field.value
                            elif field.name in FitParser.FIELD_MAPPING.values():
                                # Already canonical name (rare but possible)
                                row[field.name] = field.value
                            # We can also capture unknown fields if needed
                        
                        # Handle fields that might be missing in the row mapping but present in definition
                        # Specifically for 'power' logic priority: handled in post-processing
                        data.append(row)
        except Exception as e:
             # If fitdecode raises a critical error, we re-raise it, but it handles most warnings itself.
             raise ValueError(f"Error parsing FIT file: {e}")

        if not data:
            raise ValueError("No 'record' data found in FIT file.")

        df = pd.DataFrame(data)

        # 2. Canonical Cleaning
        # Dedup columns if both enhanced and normal exist (e.g. speed) - pandas handles duplicate keys in dict by overwriting, 
        # so last one wins. In mapping, enhanced keys usually appear after or we rely on explicit selection.
        # But 'row' dict overwrites. Let's ensure priority.
        # Actually fitdecode yields unique field names per record.
        
        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        # 3. Handle Power Priority
        # (If we had multiple power sources, we'd pick here. For now 'power' is usually the main one).
        
        # 4. Resampling to 1Hz (The Vectorization Key)
        df = df.set_index('timestamp')
        
        # Remove duplicate timestamps if any
        df = df[~df.index.duplicated(keep='first')]
        
        # Resample to 1s to regularize the grid
        # This inserts NaNs for missing seconds
        df_resampled = df.resample('1s').mean()
        
        # 5. Smart Filling (Gap Handling)
        # We interpolate small gaps (<= 10s) to keep continuity for moving averages
        # We leave large gaps (> 10s) as NaN to represent stops/pauses
        limit_seconds = 10
        df_filled = df_resampled.interpolate(method='time', limit=limit_seconds)
        
        # 6. Post-fill cleanup
        # Reset index to make timestamp a column again
        df_filled = df_filled.reset_index()
        
        # Ensure numeric types
        numeric_cols = ['heart_rate', 'power', 'speed', 'cadence', 'altitude']
        for col in numeric_cols:
            if col in df_filled.columns:
                df_filled[col] = df_filled[col].astype(float)
        
        return df_filled
