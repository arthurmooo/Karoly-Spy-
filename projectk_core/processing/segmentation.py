import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from projectk_core.logic.models import SegmentData

class SegmentCalculator:
    """
    Handles slicing of activity streams and calculation of phase-specific metrics.
    """
    
    def calculate_segment(self, df: pd.DataFrame, activity_type: str) -> SegmentData:
        """
        Calculates HR, Speed/Power, Ratio and Torque for a given data slice.
        Following Karoly's logic: Run uses km/h, Bike uses Watts.
        """
        if df.empty:
            return SegmentData()
            
        # Common: Heart Rate (Karoly uses mean)
        avg_hr = float(df['heart_rate'].mean()) if 'heart_rate' in df.columns else None
        
        # Sport Specific: Speed or Power
        avg_speed = None
        avg_power = None
        avg_torque = None
        ratio = None
        
        # Robust sport check
        s = activity_type.lower()
        is_bike = any(x in s for x in ["bike", "ride", "cycling", "vélo", "vtt", "gravel"])
        is_run = any(x in s for x in ["run", "trail", "hiking", "randonnée", "ski", "course", "rando"])
        is_home_trainer = any(x in s for x in ["home trainer", "home-trainer", "virtual ride", "ht"])

        if is_bike:
            # Karoly ignores 0 power for decoupling analysis usually.
            # HT robustness: filter very low power noise before quarter ratios.
            pwr_series = df['power'][df['power'] > 0] if 'power' in df.columns else pd.Series(dtype=float)
            if not pwr_series.empty and is_home_trainer:
                median_power = float(pwr_series.median())
                power_floor = max(100.0, median_power * 0.45)
                filtered = pwr_series[pwr_series >= power_floor]
                if len(filtered) >= 30:
                    pwr_series = filtered
            avg_power = float(pwr_series.mean()) if not pwr_series.empty else None

            if is_home_trainer and avg_power is not None and 'heart_rate' in df.columns and 'power' in df.columns:
                hr_mask = (df['power'] > 0)
                median_power = float(df.loc[hr_mask, 'power'].median()) if hr_mask.any() else 0.0
                power_floor = max(100.0, median_power * 0.45) if median_power > 0 else 100.0
                hr_mask = hr_mask & (df['power'] >= power_floor)
                hr_series = df.loc[hr_mask, 'heart_rate'].dropna()
                if len(hr_series) >= 30:
                    avg_hr = float(hr_series.mean())
            
            avg_torque = float(df['torque'].mean()) if 'torque' in df.columns else None
            
            if avg_power and avg_hr and avg_power > 0:
                # Raw Ratio: avg_hr / avg_power
                ratio = avg_hr / avg_power
        elif is_run:
            # Run/Trail: Karoly uses km/h
            if 'speed' in df.columns:
                speed_series = df['speed'][df['speed'] > 0]
                raw_speed_avg = speed_series.mean()
                if raw_speed_avg < 15: # Likely m/s
                    avg_speed = float(raw_speed_avg * 3.6)
                else:
                    avg_speed = float(raw_speed_avg)
                    
            if avg_speed and avg_hr and avg_speed > 0:
                # Efficiency Factor: HR / Speed (km/h)
                ratio = avg_hr / avg_speed
        # Other sports (Swim, Strength) only get HR by default in SegmentData
                
        return SegmentData(
            hr=avg_hr,
            speed=avg_speed,
            power=avg_power,
            ratio=ratio,
            torque=avg_torque
        )

    def auto_split(self, df: pd.DataFrame, n_phases: int, activity_type: str) -> Dict[str, SegmentData]:
        """
        Splits the activity into N equal phases based on index.
        """
        if df.empty:
            return {}
            
        n = len(df)
        step = n // n_phases
        splits = {}
        
        for i in range(n_phases):
            start_idx = i * step
            # For the last phase, take until the end to avoid rounding issues
            end_idx = (i + 1) * step if i < n_phases - 1 else n
            
            phase_df = df.iloc[start_idx:end_idx]
            splits[f"phase_{i+1}"] = self.calculate_segment(phase_df, activity_type)
            
        return splits

    def manual_split(self, df: pd.DataFrame, manual_config: List[Dict[str, Any]], activity_type: str) -> Dict[str, SegmentData]:
        """
        Splits the activity based on manual time or distance markers.
        Config example: {"start": 0, "end": 3600, "unit": "sec", "label": "Block 1"}
        """
        if df.empty:
            return {}
            
        splits = {}
        for i, config in enumerate(manual_config):
            start = config["start"]
            end = config["end"]
            unit = config.get("unit", "sec")
            
            if unit == "km":
                # Assuming 'distance' column is cumulative meters
                phase_df = df[(df['distance'] >= start * 1000) & (df['distance'] <= end * 1000)]
            elif unit == "timestamp":
                # Slice by actual datetime objects
                phase_df = df[(df['timestamp'] >= pd.to_datetime(start)) & (df['timestamp'] <= pd.to_datetime(end))]
            else:
                # Time in seconds from start
                if 'timestamp' in df.columns:
                    start_time = df['timestamp'].iloc[0]
                    # Create elapsed seconds column
                    elapsed = (df['timestamp'] - start_time).dt.total_seconds()
                    phase_df = df[(elapsed >= start) & (elapsed <= end)]
                else:
                    phase_df = df.iloc[int(start):int(end)]
            
            label = config.get("label", f"phase_{i+1}")
            splits[label] = self.calculate_segment(phase_df, activity_type)
            
        return splits

    def calculate_drift(self, splits: Dict[str, SegmentData]) -> Optional[float]:
        """
        Calculates the percentage drift between the first and last phase.
        Following Karoly: ((Ratio_last / Ratio_first) - 1) * 100
        """
        if not splits or len(splits) < 2:
            return None
            
        keys = list(splits.keys())
        first = splits[keys[0]]
        last = splits[keys[-1]]
        
        if first.ratio and last.ratio and first.ratio > 0:
            return ((last.ratio / first.ratio) - 1) * 100
        return None
