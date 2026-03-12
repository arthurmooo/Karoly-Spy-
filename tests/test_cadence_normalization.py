import pandas as pd
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from projectk_core.logic.interval_engine import IntervalMetricsCalculator, LapAnalyzer
from projectk_core.logic.models import IntervalBlock, DetectionSource
from projectk_core.processing.stream_sampler import downsample_streams, serialize_laps


def test_downsample_streams_doubles_run_cadence_only():
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2026-03-10", periods=5, freq="s"),
            "heart_rate": [150, 151, 152, 153, 154],
            "cadence": [85, 85, 85, 85, 85],
        }
    )

    run_points = downsample_streams(df, interval_sec=5, sport="run")
    bike_points = downsample_streams(df, interval_sec=5, sport="bike")

    assert run_points[0]["cad"] == 170
    assert bike_points[0]["cad"] == 85


def test_serialize_laps_doubles_run_cadence_only():
    laps = [{"start_time": pd.Timestamp("2026-03-10T10:00:00Z"), "avg_cadence": 86}]
    start_time = pd.Timestamp("2026-03-10T10:00:00Z")

    run_laps = serialize_laps(laps, start_time, sport="run")
    bike_laps = serialize_laps(laps, start_time, sport="bike")

    assert run_laps[0]["avg_cadence"] == 172
    assert bike_laps[0]["avg_cadence"] == 86


def test_interval_metrics_calculator_doubles_run_cadence_only():
    df = pd.DataFrame(
        {
            "time": [0, 1, 2, 3],
            "cadence": [84.0, 85.0, 86.0, 85.0],
            "heart_rate": [150.0, 150.0, 150.0, 150.0],
        }
    )
    block = IntervalBlock(start_time=0, end_time=3, type="active", detection_source=DetectionSource.ALGO)

    run_block = IntervalMetricsCalculator(df.copy(), sport="run").calculate(block.model_copy())
    bike_block = IntervalMetricsCalculator(df.copy(), sport="bike").calculate(block.model_copy())

    assert run_block.avg_cadence == 170.0
    assert bike_block.avg_cadence == 85.0


def test_lap_analyzer_doubles_run_cadence_only():
    raw_laps = [
        {
            "start_time": 0,
            "total_elapsed_time": 60,
            "avg_speed": 4.5,
            "avg_cadence": 88,
        }
    ]

    run_blocks = LapAnalyzer(raw_laps, sport="run").to_blocks()
    bike_blocks = LapAnalyzer(raw_laps, sport="bike").to_blocks()

    assert run_blocks[0].avg_cadence == 176.0
    assert bike_blocks[0].avg_cadence == 88.0
