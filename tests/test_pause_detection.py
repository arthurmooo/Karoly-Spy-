"""
Tests for pause detection and stream downsampling with pause exclusion.
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta

from projectk_core.processing.stream_sampler import (
    detect_pause_mask,
    downsample_streams,
    serialize_laps,
)


def _make_df(speeds: list[float], hr: float = 140.0) -> pd.DataFrame:
    """Create a 1Hz DataFrame with given speed values."""
    n = len(speeds)
    timestamps = [datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc) + timedelta(seconds=i) for i in range(n)]
    return pd.DataFrame({
        "timestamp": timestamps,
        "speed": speeds,
        "heart_rate": [hr] * n,
    })


class TestDetectPauseMask:
    def test_no_pause(self):
        """All speeds above threshold -> no pauses detected."""
        df = _make_df([4.0] * 100)
        mask = detect_pause_mask(df, sport="Run")
        assert not mask.any()

    def test_short_stop_ignored(self):
        """Stop shorter than 20s should NOT be marked as pause."""
        speeds = [4.0] * 50 + [0.0] * 10 + [4.0] * 50
        df = _make_df(speeds)
        mask = detect_pause_mask(df, sport="Run")
        assert not mask.any()

    def test_long_pause_detected(self):
        """Stop >= 20s should be marked as pause."""
        speeds = [4.0] * 50 + [0.0] * 30 + [4.0] * 50
        df = _make_df(speeds)
        mask = detect_pause_mask(df, sport="Run")
        assert mask.sum() == 30
        assert mask[50] == True
        assert mask[79] == True
        assert mask[49] == False
        assert mask[80] == False

    def test_multiple_pauses(self):
        """Multiple pauses detected independently."""
        speeds = [4.0] * 30 + [0.0] * 25 + [4.0] * 30 + [0.0] * 20 + [4.0] * 30
        df = _make_df(speeds)
        mask = detect_pause_mask(df, sport="Run")
        assert mask.sum() == 45  # 25 + 20

    def test_bike_lower_threshold(self):
        """Bike uses 1.0 m/s threshold — speeds between 1.0 and 1.5 should NOT be pauses on bike."""
        speeds = [5.0] * 30 + [1.2] * 25 + [5.0] * 30
        df = _make_df(speeds)

        mask_run = detect_pause_mask(df, sport="Run")
        mask_bike = detect_pause_mask(df, sport="Bike")

        assert mask_run.sum() == 25  # Run: 1.2 < 1.5 threshold
        assert mask_bike.sum() == 0  # Bike: 1.2 > 1.0 threshold

    def test_trailing_pause(self):
        """Pause at end of activity."""
        speeds = [4.0] * 50 + [0.0] * 25
        df = _make_df(speeds)
        mask = detect_pause_mask(df, sport="Run")
        assert mask.sum() == 25

    def test_empty_df(self):
        """Empty DataFrame returns empty mask."""
        df = pd.DataFrame()
        mask = detect_pause_mask(df, sport="Run")
        assert len(mask) == 0

    def test_no_speed_column(self):
        """No speed column returns all-False mask."""
        df = pd.DataFrame({"heart_rate": [140] * 50})
        mask = detect_pause_mask(df, sport="Run")
        assert not mask.any()
        assert len(mask) == 50


class TestDownsampleWithPauseExclusion:
    def test_pause_excluded_continuous_t(self):
        """With pause exclusion, t values should be continuous (no gaps)."""
        speeds = [4.0] * 50 + [0.0] * 30 + [4.0] * 50
        df = _make_df(speeds)
        points = downsample_streams(df, interval_sec=5, sport="Run", exclude_pauses=True)

        # Should have ~100 active seconds -> ~20 buckets
        assert len(points) > 0
        t_values = [p["t"] for p in points]
        # t should be 0, 5, 10, ... with no gap around the pause
        for i in range(1, len(t_values)):
            assert t_values[i] - t_values[i - 1] == 5

    def test_pause_excluded_fewer_points(self):
        """Excluding pauses should produce fewer points than including them."""
        speeds = [4.0] * 50 + [0.0] * 60 + [4.0] * 50
        df = _make_df(speeds)
        points_with = downsample_streams(df, interval_sec=5, sport="Run", exclude_pauses=False)
        points_without = downsample_streams(df, interval_sec=5, sport="Run", exclude_pauses=True)

        assert len(points_without) < len(points_with)

    def test_no_pause_same_result(self):
        """If there are no pauses, both modes should produce similar results."""
        speeds = [4.0] * 100
        df = _make_df(speeds)
        points_with = downsample_streams(df, interval_sec=5, sport="Run", exclude_pauses=False)
        points_without = downsample_streams(df, interval_sec=5, sport="Run", exclude_pauses=True)

        assert len(points_without) == len(points_with)


class TestSerializeLapsTimerTime:
    def test_prefers_timer_time(self):
        """serialize_laps should prefer total_timer_time (active) over total_elapsed_time."""
        laps = [{
            "start_time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            "total_timer_time": 300.0,
            "total_elapsed_time": 360.0,
            "total_distance": 1000.0,
        }]
        result = serialize_laps(laps, datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc))
        assert result[0]["duration_sec"] == 300.0

    def test_falls_back_to_elapsed(self):
        """If total_timer_time is missing, use total_elapsed_time."""
        laps = [{
            "start_time": datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            "total_elapsed_time": 360.0,
            "total_distance": 1000.0,
        }]
        result = serialize_laps(laps, datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc))
        assert result[0]["duration_sec"] == 360.0

    def test_computes_lap_power_with_and_without_zeros_from_stream_df(self):
        timestamps = [datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc) + timedelta(seconds=i) for i in range(6)]
        df = pd.DataFrame(
            {
                "timestamp": timestamps,
                "timer_time": [0, 1, 2, 3, 4, 5],
                "power": [0.0, 100.0, 0.0, 200.0, 0.0, 0.0],
            }
        )
        laps = [{
            "start_time": timestamps[0],
            "total_timer_time": 6.0,
            "avg_power": 999.0,  # should be replaced by stream-derived no-zero value
        }]

        result = serialize_laps(
            laps,
            datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
            sport="bike",
            stream_df=df,
        )

        assert result[0]["avg_power"] == 150
        assert result[0]["avg_power_with_zeros"] == 50
