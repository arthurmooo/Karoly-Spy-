
import os
import sys
import pandas as pd
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import UniversalParser

def check_offset(file_path):
    df, meta, laps = UniversalParser.parse(file_path)
    print(f"File: {file_path}")
    print(f"  Meta Start Time: {meta.get('start_time')}")
    print(f"  DF First Index:  {df.index[0] if isinstance(df.index, pd.DatetimeIndex) else df['timestamp'].iloc[0] if 'timestamp' in df.columns else 'N/A'}")
    if laps:
        print(f"  First Lap Start: {laps[0].get('start_time')}")

if __name__ == "__main__":
    check_offset("data/test_cache/Dries_2026-01-17.fit")
    check_offset("data/test_cache/Adrien_2026-01-07.fit")
