"""
Tests for US-09c: RPE integration into MLS (PER factor) and Z3 fix in INT.
"""
import pytest
import pandas as pd
import numpy as np
import sys
import os
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.models import Activity, ActivityMetadata, PhysioProfile
from projectk_core.processing.calculator import MetricsCalculator


class MockConfig:
    def get(self, key, default=0.0):
        defaults = {
            'alpha_load_hr': 0.5,
            'beta_dur': 0.08,
            'drift_threshold_percent': 3.0,
            'gamma_load_z3': 1.0,
            'k_rpe': 0.3,
        }
        return defaults.get(key, default)


@pytest.fixture
def profile_bike():
    return PhysioProfile(
        lt1_hr=140, lt2_hr=160,
        cp_cs=300, valid_from=datetime(2024, 1, 1),
    )


@pytest.fixture
def profile_run():
    return PhysioProfile(
        lt1_hr=140, lt2_hr=160,
        cp_cs=5.0, valid_from=datetime(2024, 1, 1),
        weight=70.0,
    )


def _make_bike_activity(seconds, power, hr, rpe=None):
    df = pd.DataFrame({
        'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='s'),
        'power': power if isinstance(power, list) else [power] * seconds,
        'heart_rate': hr if isinstance(hr, list) else [hr] * seconds,
        'speed': [0.0] * seconds,
    })
    meta = ActivityMetadata(
        activity_type="Ride",
        start_time=datetime(2024, 1, 1),
        duration_sec=seconds,
        rpe=rpe,
    )
    return Activity(metadata=meta, streams=df)


# ─── PER factor tests ───

class TestPERFactor:

    def test_per_neutral_when_rpe_absent(self, profile_bike):
        """RPE=None → PER=1.0, MLS unchanged."""
        activity = _make_bike_activity(3600, 200, 150, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == 1.0
        assert result['rpe_delta'] is None
        # MLS = 576 * 1.5 * 1.0 * 1.0 = 864
        assert result['mls_load'] == pytest.approx(864.0, abs=1.0)

    def test_per_neutral_when_rpe_zero(self, profile_bike):
        """RPE=0 (sync before athlete fills in) → PER=1.0, treated as absent."""
        activity = _make_bike_activity(3600, 200, 150, rpe=0)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == 1.0
        assert result['rpe_delta'] is None

    def test_per_boost_high_rpe(self, profile_bike):
        """High RPE vs low IF → PER > 1.0."""
        # Power=150W, CP=300 → IF=0.5, RPE=9 → rpe_norm=0.889
        # delta = 0.889 - 0.5 = 0.389, PER = 1 + 0.3*0.389 = 1.117
        activity = _make_bike_activity(3600, 150, 150, rpe=9)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == pytest.approx(1.117, abs=0.01)
        assert result['rpe_delta'] == pytest.approx(0.389, abs=0.01)

    def test_per_dampen_low_rpe(self, profile_bike):
        """Low RPE vs high IF → PER < 1.0."""
        # Power=260W, CP=300 → IF=0.867, RPE=2 → rpe_norm=0.111
        # delta = 0.111 - 0.867 = -0.756, PER = 1 + 0.3*(-0.756) = 0.773 → clamped to 0.85
        activity = _make_bike_activity(3600, 260, 150, rpe=2)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == 0.85  # Clamped lower bound

    def test_per_clamped_upper(self, profile_bike):
        """PER never exceeds 1.15."""
        # Power=100W, CP=300 → IF=0.333, RPE=10 → rpe_norm=1.0
        # delta = 1.0 - 0.333 = 0.667, PER = 1 + 0.3*0.667 = 1.20 → clamped to 1.15
        activity = _make_bike_activity(3600, 100, 150, rpe=10)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == 1.15  # Clamped upper bound

    def test_per_coherent_no_effect(self, profile_bike):
        """When RPE aligns with IF → PER ≈ 1.0."""
        # Power=200W, CP=300 → IF=0.667, RPE=7 → rpe_norm=0.667
        # delta ≈ 0, PER ≈ 1.0
        activity = _make_bike_activity(3600, 200, 150, rpe=7)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['per_index'] == pytest.approx(1.0, abs=0.01)


# ─── Z3 INT index tests ───

class TestINTZ3:

    def test_int_z3_only(self, profile_bike):
        """100% time above LT2 (HR=170, LT2=160) → Z3=100%, Z2=0%."""
        # INT = 1.0 + 0.5*0 + 1.0*1.0 = 2.0
        activity = _make_bike_activity(3600, 200, 170, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['int_index'] == pytest.approx(2.0, abs=0.05)

    def test_int_z2_only(self, profile_bike):
        """100% time in Z2 (HR=150, LT1=140, LT2=160) → Z2=100%, Z3=0%."""
        # INT = 1.0 + 0.5*1.0 + 1.0*0 = 1.5
        activity = _make_bike_activity(3600, 200, 150, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['int_index'] == pytest.approx(1.5, abs=0.05)

    def test_int_z2_z3_mixed(self, profile_bike):
        """50% Z2 + 50% Z3 → INT = 1.0 + 0.5*0.5 + 1.0*0.5 = 1.75."""
        seconds = 3600
        mid = seconds // 2
        hr = [150.0] * mid + [170.0] * mid  # First half Z2, second half Z3
        activity = _make_bike_activity(seconds, 200, hr, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['int_index'] == pytest.approx(1.75, abs=0.05)

    def test_int_z1_only(self, profile_bike):
        """100% time below LT1 (HR=120) → Z2=0%, Z3=0% → INT=1.0."""
        activity = _make_bike_activity(3600, 200, 120, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['int_index'] == pytest.approx(1.0, abs=0.05)

    def test_int_z3_speed_fallback(self):
        """Z3 via speed fallback (no HR thresholds, CS=5.0, speed=5.5 > CS)."""
        seconds = 3600
        df = pd.DataFrame({
            'timestamp': pd.date_range(start='2024-01-01', periods=seconds, freq='s'),
            'speed': [5.5] * seconds,  # Above CS=5.0 → Z3
            'heart_rate': [170.0] * seconds,
        })
        meta = ActivityMetadata(
            activity_type="Run",
            activity_name="Fast run",
            start_time=datetime(2024, 1, 1),
            duration_sec=seconds,
            distance_m=19800.0,
        )
        activity = Activity(metadata=meta, streams=df)
        profile = PhysioProfile(
            lt1_hr=None, lt2_hr=None,
            cp_cs=5.0, valid_from=datetime(2024, 1, 1),
            weight=70.0,
        )
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile)

        # 5.5 > 5.0 (lt2_threshold=CS) → 100% Z3
        # INT = 1.0 + 0.5*0 + 1.0*1.0 = 2.0
        assert result['int_index'] == pytest.approx(2.0, abs=0.05)


# ─── Regression test ───

class TestRegression:

    def test_existing_mls_unchanged_no_rpe(self, profile_bike):
        """
        Reproduce test_mls_calculation_steady_state to verify no regression.
        Power=200W, CP=300 → IF=0.667, f_int=0.8
        HR=150 → 100% Z2 (140-160), 0% Z3 → INT=1.5
        DUR=1.0, PER=1.0 (no RPE)
        Energy=720kJ, MEC=576, MLS=576*1.5*1.0*1.0=864.0
        """
        activity = _make_bike_activity(3600, 200, 150, rpe=None)
        calc = MetricsCalculator(MockConfig())
        result = calc.compute(activity, profile_bike)

        assert result['energy_kj'] == 720.0
        assert result['mec'] == pytest.approx(576.0, abs=0.1)
        assert result['int_index'] == pytest.approx(1.5, abs=0.01)
        assert result['dur_index'] == pytest.approx(1.0, abs=0.01)
        assert result['per_index'] == 1.0
        assert result['mls_load'] == pytest.approx(864.0, abs=1.0)
