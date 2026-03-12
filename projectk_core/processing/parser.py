import fitdecode
import pandas as pd
import numpy as np
import os
import gzip
import shutil
import tempfile
from typing import Optional, List, Dict
from projectk_core.processing.tcx_parser import TcxParser

class UniversalParser:
    """
    Dispatcher that detects file type (FIT, TCX, GZIP) and delegates to the appropriate parser.
    Ensures a unified interface for all activity files.
    """
    
    @staticmethod
    def parse(file_path: str) -> tuple[pd.DataFrame, Dict, List[Dict]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # 1. Handle GZIP transparently
        is_gz = False
        try:
            with open(file_path, 'rb') as f:
                header = f.read(3)
                if header == b'\x1f\x8b\x08':
                    is_gz = True
        except Exception:
            pass

        actual_file_path = file_path
        temp_decompressed = None

        try:
            if is_gz:
                fd, temp_decompressed = tempfile.mkstemp()
                os.close(fd)
                with gzip.open(file_path, 'rb') as f_in:
                    with open(temp_decompressed, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                actual_file_path = temp_decompressed

            # 2. Detect File Type
            with open(actual_file_path, 'rb') as f:
                # Read enough to catch FIT header (usually ~14 bytes) and XML declaration
                head = f.read(100)
            
            # FIT files usually have .FIT at offset 8
            if b'.FIT' in head:
                # Delegate to FitParser
                # Note: FitParser can handle GZ internally too, but we already decompressed it 
                # if it was GZ, so we pass the plain file.
                return FitParser.parse(actual_file_path)
            
            # TCX / XML Check
            # Look for XML declaration or root tag
            if b'<?xml' in head or b'<TrainingCenterDatabase' in head:
                return TcxParser.parse(actual_file_path)

            raise ValueError(f"Unsupported file format or unknown signature in {file_path}")

        finally:
            # 3. Cleanup
            if temp_decompressed and os.path.exists(temp_decompressed):
                os.remove(temp_decompressed)


class FitParser:
    """
    Robust parser for .FIT files using fitdecode.
    Handles Garmin, Wahoo, and Coros formats.
    Now supports GZIP compressed files (.fit.gz).
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

        # Handle GZIP compressed files (.fit.gz)
        # Check signature 1f 8b 08
        is_gz = False
        try:
            with open(file_path, 'rb') as f:
                header = f.read(3)
                if header == b'\x1f\x8b\x08':
                    is_gz = True
        except Exception:
            pass

        actual_file_path = file_path
        temp_decompressed = None

        if is_gz:
            # Create a temporary decompressed version
            fd, temp_decompressed = tempfile.mkstemp(suffix=".fit")
            os.close(fd)
            try:
                with gzip.open(file_path, 'rb') as f_in:
                    with open(temp_decompressed, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                actual_file_path = temp_decompressed
            except Exception as e:
                if temp_decompressed and os.path.exists(temp_decompressed):
                    os.remove(temp_decompressed)
                raise ValueError(f"Failed to decompress GZIP file: {e}")

        data = []
        laps = []
        metadata = {
            'serial_number': None,
            'manufacturer': None,
            'product': None,
            'start_time': None,
            'total_ascent': None
        }
        
        # 1. Read Raw Data & Metadata
        try:
            with fitdecode.FitReader(actual_file_path) as fit:
                for frame in fit:
                    if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                        if frame.name == 'session':
                            # Session frame often has the best start_time and totals
                            for field in frame.fields:
                                if field.name == 'start_time':
                                    metadata['start_time'] = field.value
                                elif field.name == 'total_ascent':
                                    metadata['total_ascent'] = field.value
                                elif field.name == 'total_timer_time':
                                    metadata['total_timer_time'] = field.value
                                elif field.name == 'total_elapsed_time':
                                    metadata['total_elapsed_time'] = field.value
                        
                        elif frame.name == 'file_id':
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
                                # Added 'timestamp' (End Time) to help with sync issues
                                if field.name in ['start_time', 'timestamp', 'total_elapsed_time', 'total_timer_time', 'avg_heart_rate', 'avg_power', 'total_distance', 'avg_speed', 'enhanced_avg_speed']:
                                    lap_row[field.name] = field.value
                            
                            # ===== NORMALIZE LAP FIELD NAMES (2026-02-05) =====
                            # Consolidate FIT field variants to standard names

                            # Speed: enhanced_avg_speed -> avg_speed
                            spd = lap_row.get('enhanced_avg_speed')
                            if spd is None:
                                spd = lap_row.get('avg_speed')
                            if spd is not None and spd > 0:
                                lap_row['avg_speed'] = float(spd)

                            # Fallback: calculate speed from dist/dur if missing
                            if lap_row.get('avg_speed') is None or lap_row.get('avg_speed') == 0:
                                dist = lap_row.get('total_distance', 0)
                                dur = lap_row.get('total_elapsed_time', 0)
                                if dist and dur:
                                    lap_row['avg_speed'] = float(dist) / float(dur)

                            # Duration: prefer total_timer_time (active time) over total_elapsed_time (clock time)
                            dur = lap_row.get('total_timer_time') or lap_row.get('total_elapsed_time', 0)
                            if dur:
                                lap_row['duration'] = float(dur)

                            # HR: avg_heart_rate -> avg_hr (keep both for compatibility)
                            hr = lap_row.get('avg_heart_rate')
                            if hr is not None:
                                lap_row['avg_hr'] = float(hr)

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
        finally:
            # Clean up temporary file if created
            if temp_decompressed and os.path.exists(temp_decompressed):
                os.remove(temp_decompressed)

        if not data:
            raise ValueError("No 'record' data found in FIT file.")

        df = pd.DataFrame(data)
        
        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        
        # Ensure numeric columns are float BEFORE resampling to avoid object-dtype interpolation issues
        numeric_cols = ['heart_rate', 'power', 'speed', 'cadence', 'altitude', 'distance', 'temperature', 'grade', 'lat', 'lon']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
        # 1.5 Convert semicircles to degrees for GPS
        # Standard FIT formula: degrees = semicircles * (180 / 2^31)
        semicircle_to_degree = 180 / (2**31)
        for col in ['lat', 'lon']:
            if col in df.columns:
                # Ensure float type to avoid FutureWarnings and precision issues
                df[col] = df[col].astype(float)
                # Only convert if values look like semicircles (huge integers > 180)
                # Note: some files might already be in degrees, so we check range
                mask = df[col].abs() > 180
                df.loc[mask, col] = df.loc[mask, col] * semicircle_to_degree
        
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        # 2. Resampling to 1Hz
        df = df.set_index('timestamp')
        df = df[~df.index.duplicated(keep='first')]
        df_resampled = df.resample('1s').mean()
        
        # 3. Smart Filling (Gap Handling)
        limit_seconds = 10
        df_filled = df_resampled.interpolate(method='time', limit=limit_seconds)
        df_filled = df_filled.reset_index()

        # ===== ENRICH LAPS FROM STREAM (2026-02-05) =====
        # Some FIT files have LAPs with distance but no duration/HR/speed
        # (e.g., manual laps outside structured workouts)
        # Calculate missing metrics from the stream using LAP timestamps
        if laps and len(df_filled) > 0:
            laps = FitParser._enrich_laps_from_stream(laps, df_filled)

        return df_filled, metadata, laps

    @staticmethod
    def _enrich_laps_from_stream(laps: list, df: pd.DataFrame) -> list:
        """
        Enrich LAP records with metrics calculated from stream data.

        For LAPs missing duration, HR, or speed, we use the LAP timestamps
        to find the corresponding segment in the stream and calculate metrics.
        """
        if 'timestamp' not in df.columns:
            return laps

        enriched = []
        for lap in laps:
            lap_copy = lap.copy()

            # Get LAP time boundaries
            start_time = lap.get('start_time')
            end_time = lap.get('timestamp')  # 'timestamp' in LAP record is end time

            # Skip if no timestamps
            if not start_time or not end_time:
                enriched.append(lap_copy)
                continue

            # Ensure timezone-aware comparison
            if hasattr(start_time, 'tzinfo') and start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=pd.Timestamp.now().tzinfo)
            if hasattr(end_time, 'tzinfo') and end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=pd.Timestamp.now().tzinfo)

            # Find stream segment for this LAP
            mask = (df['timestamp'] >= start_time) & (df['timestamp'] <= end_time)
            segment = df[mask]

            if len(segment) < 2:
                enriched.append(lap_copy)
                continue

            # Calculate duration if missing or zero
            duration = lap_copy.get('total_elapsed_time', 0) or lap_copy.get('total_timer_time', 0)
            if not duration or duration == 0:
                duration = len(segment)  # 1Hz resampled, so len = seconds
                lap_copy['total_elapsed_time'] = duration
                lap_copy['duration'] = duration
            else:
                lap_copy['duration'] = duration

            # Calculate avg_hr if missing
            if not lap_copy.get('avg_heart_rate') and 'heart_rate' in segment.columns:
                hr_valid = segment['heart_rate'].dropna()
                if len(hr_valid) > 0:
                    lap_copy['avg_heart_rate'] = hr_valid.mean()
                    lap_copy['avg_hr'] = hr_valid.mean()

            # Calculate avg_speed if missing
            if not lap_copy.get('avg_speed') and 'speed' in segment.columns:
                spd_valid = segment['speed'].dropna()
                if len(spd_valid) > 0:
                    lap_copy['avg_speed'] = spd_valid.mean()

            # Calculate avg_power if missing
            if not lap_copy.get('avg_power') and 'power' in segment.columns:
                pwr_valid = segment['power'].dropna()
                if len(pwr_valid) > 0:
                    lap_copy['avg_power'] = pwr_valid.mean()

            # Ensure distance is preserved
            if lap_copy.get('total_distance'):
                lap_copy['total_distance'] = float(lap_copy['total_distance'])

            enriched.append(lap_copy)

        return enriched
