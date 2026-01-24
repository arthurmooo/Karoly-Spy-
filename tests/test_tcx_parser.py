import pytest
import pandas as pd
import tempfile
import os
from projectk_core.processing.tcx_parser import TcxParser

# Minimal TCX Sample
TCX_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>2026-01-24T10:00:00Z</Id>
      <Lap StartTime="2026-01-24T10:00:00Z">
        <TotalTimeSeconds>10.0</TotalTimeSeconds>
        <DistanceMeters>50.0</DistanceMeters>
        <MaximumSpeed>6.5</MaximumSpeed>
        <Calories>50</Calories>
        <AverageHeartRateBpm>
          <Value>140</Value>
        </AverageHeartRateBpm>
        <MaximumHeartRateBpm>
          <Value>150</Value>
        </MaximumHeartRateBpm>
        <Track>
          <Trackpoint>
            <Time>2026-01-24T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>48.8566</LatitudeDegrees>
              <LongitudeDegrees>2.3522</LongitudeDegrees>
            </Position>
            <AltitudeMeters>100.0</AltitudeMeters>
            <DistanceMeters>0.0</DistanceMeters>
            <HeartRateBpm>
              <Value>130</Value>
            </HeartRateBpm>
            <Cadence>80</Cadence>
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>5.0</Speed>
                <Watts>200</Watts>
              </TPX>
            </Extensions>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-01-24T10:00:01Z</Time>
            <Position>
              <LatitudeDegrees>48.8567</LatitudeDegrees>
              <LongitudeDegrees>2.3523</LongitudeDegrees>
            </Position>
            <AltitudeMeters>100.5</AltitudeMeters>
            <DistanceMeters>5.0</DistanceMeters>
            <HeartRateBpm>
              <Value>132</Value>
            </HeartRateBpm>
            <Cadence>82</Cadence>
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>5.2</Speed>
                <Watts>210</Watts>
              </TPX>
            </Extensions>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
"""

@pytest.fixture
def tcx_file():
    """Creates a temporary TCX file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.tcx', delete=False) as tmp:
        tmp.write(TCX_SAMPLE)
        tmp_path = tmp.name
    yield tmp_path
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

def test_tcx_parser_structure(tcx_file):
    """Test if TcxParser parses the structure correctly and returns expected objects."""
    df, metadata, laps = TcxParser.parse(tcx_file)
    
    assert isinstance(df, pd.DataFrame)
    assert isinstance(metadata, dict)
    assert isinstance(laps, list)
    
    # Check DataFrame Columns (Parity with FitParser)
    expected_cols = ['heart_rate', 'power', 'cadence', 'speed', 'altitude', 'distance', 'lat', 'lon']
    for col in expected_cols:
        assert col in df.columns, f"Missing column: {col}"

    # Check Data types
    assert pd.api.types.is_datetime64_any_dtype(df['timestamp'])
    
    # Check Values (First row)
    row0 = df.iloc[0]
    assert row0['heart_rate'] == 130
    assert row0['power'] == 200
    assert row0['cadence'] == 80
    assert row0['altitude'] == 100.0
    
    # Check Values (Second row)
    row1 = df.iloc[1]
    assert row1['heart_rate'] == 132
    assert row1['power'] == 210

def test_tcx_parser_resampling(tcx_file):
    """Test if TcxParser correctly resamples to 1Hz."""
    df, _, _ = TcxParser.parse(tcx_file)
    
    # The sample has 2 points at 00:00 and 00:01. 
    # The parser should ideally return a dataframe with these timestamps.
    assert len(df) >= 2
    
    # Check frequency (approximate check since we only have 2 points)
    time_diff = df['timestamp'].diff().iloc[1]
    assert time_diff.total_seconds() == 1.0

def test_tcx_metadata(tcx_file):
    """Test metadata extraction."""
    _, metadata, laps = TcxParser.parse(tcx_file)
    
    # Start time
    assert metadata['start_time'] is not None
    # We expect a datetime object (UTC)
    assert metadata['start_time'].year == 2026
    assert metadata['start_time'].month == 1
    assert metadata['start_time'].day == 24
    
    # Laps
    assert len(laps) == 1
    assert laps[0]['start_time'] is not None
    assert laps[0]['total_elapsed_time'] == 10.0
