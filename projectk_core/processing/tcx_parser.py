import pandas as pd
import xml.etree.ElementTree as ET
import os
from typing import Dict, List, Tuple, Optional
import dateutil.parser

class TcxParser:
    """
    Parser for .TCX files (Training Center XML).
    Extracts 1Hz time-series data and metadata, ensuring parity with FitParser output.
    """

    # Namespace map (might need expansion for other vendors)
    NAMESPACES = {
        'ns': 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2',
        'ns3': 'http://www.garmin.com/xmlschemas/ActivityExtension/v2',
    }

    @staticmethod
    def _strip_ns(tag: str) -> str:
        """Removes the namespace from a tag name."""
        if '}' in tag:
            return tag.split('}', 1)[1]
        return tag

    @staticmethod
    def parse(file_path: str) -> Tuple[pd.DataFrame, Dict, List[Dict]]:
        """
        Parses a .TCX file and returns:
        1. df_filled: 1Hz resampled DataFrame
        2. metadata: Device info (limited in TCX)
        3. laps: List of lap summaries
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
        except ET.ParseError as e:
            raise ValueError(f"Invalid XML/TCX file: {e}")

        # Basic Namespace handling: 
        # We'll just search by local name to be robust against namespace variations
        # Helper to find all elements by local name
        def find_all_recursive(element, local_name):
            found = []
            for child in element:
                if TcxParser._strip_ns(child.tag) == local_name:
                    found.append(child)
                found.extend(find_all_recursive(child, local_name))
            return found

        activities = find_all_recursive(root, 'Activity')
        if not activities:
            raise ValueError("No 'Activity' found in TCX file.")

        # We assume one activity per file for now (standard export)
        activity = activities[0]
        
        metadata = {
            'serial_number': None, # TCX rarely has this
            'manufacturer': None,
            'product': None,
            'start_time': None,
            'total_ascent': None
        }

        # Get Sport
        # metadata['sport'] = activity.get('Sport') # Not in FitParser metadata spec but good to have?

        laps_data = []
        trackpoints_data = []

        # Find Laps
        laps_xml = find_all_recursive(activity, 'Lap')
        
        # Set Activity Start Time from first Lap
        if laps_xml:
            first_lap_start = laps_xml[0].get('StartTime')
            if first_lap_start:
                metadata['start_time'] = dateutil.parser.parse(first_lap_start)

        for lap in laps_xml:
            lap_info = {}
            lap_info['start_time'] = dateutil.parser.parse(lap.get('StartTime'))
            
            # Extract Lap Metrics
            for child in lap:
                tag = TcxParser._strip_ns(child.tag)
                val = child.text
                if tag == 'TotalTimeSeconds':
                    lap_info['total_elapsed_time'] = float(val)
                elif tag == 'DistanceMeters':
                    lap_info['total_distance'] = float(val)
                elif tag == 'AverageHeartRateBpm':
                     val_elem = find_all_recursive(child, 'Value')
                     if val_elem: lap_info['avg_heart_rate'] = float(val_elem[0].text)
                elif tag == 'MaximumHeartRateBpm':
                     # FitParser doesn't strictly require max HR in lap summary for intervals, but good to have
                     pass
                elif tag == 'MaximumSpeed':
                    # FitParser uses 'enhanced_max_speed' or 'max_speed'
                    pass
                elif tag == 'Watts': # Sometimes in extensions
                    pass

            # Calculate average speed if missing
            if 'total_distance' in lap_info and 'total_elapsed_time' in lap_info and lap_info['total_elapsed_time'] > 0:
                lap_info['avg_speed'] = lap_info['total_distance'] / lap_info['total_elapsed_time']

            laps_data.append(lap_info)

            # Process Track (Trackpoints) within this Lap
            lap_hr_values = []  # accumulate HR per lap to compute avg if absent from LAP summary
            tracks = find_all_recursive(lap, 'Track')
            for track in tracks:
                tps = find_all_recursive(track, 'Trackpoint')
                for tp in tps:
                    point = {}

                    # Time (Required)
                    time_elem = find_all_recursive(tp, 'Time')
                    if not time_elem: continue
                    point['timestamp'] = time_elem[0].text # String for now

                    # Position
                    pos_elem = find_all_recursive(tp, 'Position')
                    if pos_elem:
                        lat_elem = find_all_recursive(pos_elem[0], 'LatitudeDegrees')
                        lon_elem = find_all_recursive(pos_elem[0], 'LongitudeDegrees')
                        if lat_elem and lon_elem:
                            point['lat'] = float(lat_elem[0].text)
                            point['lon'] = float(lon_elem[0].text)

                    # Altitude
                    alt_elem = find_all_recursive(tp, 'AltitudeMeters')
                    if alt_elem:
                        point['altitude'] = float(alt_elem[0].text)

                    # Distance
                    dist_elem = find_all_recursive(tp, 'DistanceMeters')
                    if dist_elem:
                        point['distance'] = float(dist_elem[0].text)

                    # Heart Rate
                    hr_elem = find_all_recursive(tp, 'HeartRateBpm')
                    if hr_elem:
                        val_elem = find_all_recursive(hr_elem[0], 'Value')
                        if val_elem:
                            hr_val = float(val_elem[0].text)
                            point['heart_rate'] = hr_val
                            lap_hr_values.append(hr_val)

                    # Cadence
                    cad_elem = find_all_recursive(tp, 'Cadence')
                    if cad_elem:
                        point['cadence'] = float(cad_elem[0].text)

                    # Extensions (TPX) for Speed and Watts
                    ext_elem = find_all_recursive(tp, 'Extensions')
                    if ext_elem:
                        tpx_elem = find_all_recursive(ext_elem[0], 'TPX')
                        if tpx_elem:
                            speed_elem = find_all_recursive(tpx_elem[0], 'Speed')
                            if speed_elem:
                                point['speed'] = float(speed_elem[0].text)

                            watts_elem = find_all_recursive(tpx_elem[0], 'Watts')
                            if watts_elem:
                                point['power'] = float(watts_elem[0].text)

                    trackpoints_data.append(point)

            # Backfill avg_hr on lap_info if absent from TCX LAP summary
            # (some exports omit AverageHeartRateBpm even when trackpoints have HR)
            if lap_hr_values and 'avg_heart_rate' not in lap_info:
                mean_hr = sum(lap_hr_values) / len(lap_hr_values)
                lap_info['avg_heart_rate'] = mean_hr
                lap_info['avg_hr'] = mean_hr

        if not trackpoints_data:
            raise ValueError("No Trackpoints found in TCX file.")

        df = pd.DataFrame(trackpoints_data)
        
        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        
        # Ensure numeric columns
        numeric_cols = ['heart_rate', 'power', 'speed', 'cadence', 'altitude', 'distance', 'lat', 'lon']
        for col in numeric_cols:
             if col not in df.columns:
                 # Initialize missing columns with NaN to ensure parity structure
                 # Actually, better to only convert if they exist, but tests might expect them
                 # Let's align with FitParser which just coerces existing.
                 pass
             else:
                 df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.sort_values('timestamp').reset_index(drop=True)

        # 2. Resampling to 1Hz (Logic copied from FitParser)
        df = df.set_index('timestamp')
        df = df[~df.index.duplicated(keep='first')]
        
        # Reindex to full second range to fill gaps
        # But first, we resample.
        df_resampled = df.resample('1s').mean()
        
        # 3. Smart Filling (Gap Handling)
        limit_seconds = 10
        df_filled = df_resampled.interpolate(method='time', limit=limit_seconds)
        df_filled = df_filled.reset_index()
        
        return df_filled, metadata, laps_data
