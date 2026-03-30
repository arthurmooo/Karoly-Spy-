import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from projectk_core.logic.form_analysis import ComparableRow, FormAnalysisEngine, SOT_VERSION, _extract_current_temperature
from projectk_core.logic.models import Activity, ActivityMetadata


class StubFormAnalysisEngine(FormAnalysisEngine):
    def __init__(self, rows):
        self.db = None
        self._rows = rows

    def _fetch_candidate_rows(self, **kwargs):
        return list(self._rows)


def make_bike_activity(*, start_time, temp, rpe, power=200.0, hr=150.0):
    seconds = 3600
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range(start=start_time, periods=seconds, freq="s"),
            "power": [power] * seconds,
            "heart_rate": [hr] * seconds,
            "temperature": [temp] * seconds,
        }
    )
    meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="Tempo vélo",
        source_sport="Bike",
        start_time=start_time,
        duration_sec=seconds,
        rpe=rpe,
        temp_avg=temp,
        work_type="endurance",
    )
    return Activity(metadata=meta, streams=df)


def make_interval_activity(*, start_time, temp, rpe):
    seconds = 3600
    power = []
    hr = []
    for idx in range(seconds):
        rep_idx = idx // 360
        in_rep = idx % 360
        if rep_idx < 6 and in_rep < 300:
            power.append(260.0)
            hr.append(145.0 + min(in_rep / 60.0, 5.0))
        else:
            power.append(120.0)
            hr.append(120.0)

    df = pd.DataFrame(
        {
            "timestamp": pd.date_range(start=start_time, periods=seconds, freq="s"),
            "power": power,
            "heart_rate": hr,
            "temperature": [temp] * seconds,
        }
    )
    meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="6x5 tempo",
        source_sport="Bike",
        start_time=start_time,
        duration_sec=seconds,
        rpe=rpe,
        temp_avg=temp,
        work_type="intervals",
    )
    return Activity(metadata=meta, streams=df)


def make_run_activity(
    *,
    start_time,
    temp,
    rpe,
    speed=4.0,
    hr=150.0,
    with_altitude=True,
    with_distance=True,
    with_native_grade=False,
):
    seconds = 3600
    timestamps = pd.date_range(start=start_time, periods=seconds, freq="s")
    speed_series = np.full(seconds, speed, dtype=float)
    distance = np.cumsum(speed_series) - speed_series[0]

    data = {
        "timestamp": timestamps,
        "speed": speed_series,
        "heart_rate": np.full(seconds, hr, dtype=float),
        "temperature": np.full(seconds, temp, dtype=float),
    }
    if with_distance:
        data["distance"] = distance
    if with_altitude:
        data["altitude"] = 80.0 + (distance * 0.005) + np.sin(distance / 60.0) * 0.5
    if with_native_grade:
        data["grade"] = np.full(seconds, 0.005, dtype=float)

    df = pd.DataFrame(data)
    meta = ActivityMetadata(
        activity_type="Run",
        activity_name="Endurance trail",
        source_sport="Course a pied",
        start_time=start_time,
        duration_sec=seconds,
        rpe=rpe,
        temp_avg=temp,
        work_type="endurance",
    )
    return Activity(metadata=meta, streams=df)


def build_comparable_row(*, session_date, template_key, module, temp, hr_corr, output_mean, ea_today, dec_today, rpe, ea_delta=0.0, dec_delta=0.0, hrend=2.0, first_pair=None):
    template_duration = 1800.0 if module == "continuous_tempo" else 90.0
    return ComparableRow(
        id=f"row-{session_date.isoformat()}",
        session_date=session_date,
        duration_sec=template_duration,
        rpe=rpe,
        temp_avg=temp,
        form_analysis={
            "version": SOT_VERSION,
            "module": module,
            "template_key": template_key,
            "template": {"duration_sec": template_duration},
            "output": {"mean": output_mean},
            "temperature": {"temp": temp, "hr_mean_raw": hr_corr, "hr_corr": hr_corr},
            "ea": {
                "today": ea_today,
                "baseline": ea_today,
                "delta_pct": ea_delta,
                "first_pair": first_pair if first_pair is not None else ea_today,
            },
            "decoupling": {"today": dec_today, "delta": dec_delta},
            "hrend_drift": {"today": hrend},
            "rpe": {"today": rpe},
            "decision": {"final": "stable", "durability_flag": False},
        },
    )


def test_continuous_form_analysis_improvement_same_temp_bin():
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_bike_activity(start_time=start, temp=20.0, rpe=4.0, power=200.0, hr=150.0)
    engine = StubFormAnalysisEngine([])

    first_pass = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )
    template_key = first_pass["template_key"]

    rows = [
        build_comparable_row(
            session_date=start - timedelta(days=index + 1),
            template_key=template_key,
            module="continuous_tempo",
            temp=20.5,
            hr_corr=153.0,
            output_mean=200.0,
            ea_today=1.31,
            dec_today=1.0,
            rpe=5.0,
        )
        for index in range(6)
    ]
    engine = StubFormAnalysisEngine(rows)

    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )

    assert analysis["comparison_mode"] == "same_temp_bin"
    assert analysis["decision"]["global"] == "amelioration"
    assert analysis["decision"]["final"] == "amelioration"
    assert analysis["comparable_count"] == 6


def test_interval_form_analysis_alert_pattern():
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_interval_activity(start_time=start, temp=18.0, rpe=6.0)
    interval_details = [
        {"status": "matched", "start_index": idx * 360, "end_index": idx * 360 + 300, "duration_sec": 300}
        for idx in range(6)
    ]
    engine = StubFormAnalysisEngine([])

    first_pass = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
        interval_details=interval_details,
    )
    template_key = first_pass["template_key"]

    output_mean = first_pass["output"]["mean"]
    rows = [
        build_comparable_row(
            session_date=start - timedelta(days=index + 1),
            template_key=template_key,
            module="intervals",
            temp=18.5,
            hr_corr=155.0,
            output_mean=output_mean,
            ea_today=1.94,
            dec_today=-3.0,
            rpe=4.0,
            hrend=-2.0,
            first_pair=1.96,
        )
        for index in range(6)
    ]
    engine = StubFormAnalysisEngine(rows)

    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
        interval_details=interval_details,
    )

    assert analysis["decision"]["module"] == "alerte_intervalles"
    assert analysis["decision"]["global"] == "signal_alarme"
    assert analysis["decision"]["final"] == "alerte_renforcee"
    assert analysis["decision"]["durability_flag"] is True
    assert analysis["ea"]["delta_pct"] < 0


def test_run_outdoor_uses_derived_grade_for_gap_speed():
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_run_activity(start_time=start, temp=11.0, rpe=4.0)
    engine = StubFormAnalysisEngine([])

    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )

    assert analysis is not None
    assert analysis["output"]["metric"] == "gap_speed_kmh"
    assert analysis["output"]["normalization"] == "gap_speed_derived_grade"
    assert analysis["output"]["grade_source"] == "derived_altitude_distance"
    assert analysis["output"]["grade_quality"] in {"high", "medium"}
    assert analysis["output"]["grade_valid_points"] > 0


def test_run_outdoor_falls_back_to_speed_when_grade_is_unavailable():
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_run_activity(start_time=start, temp=11.0, rpe=4.0, with_altitude=False)
    engine = StubFormAnalysisEngine([])

    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )

    assert analysis is not None
    assert analysis["output"]["metric"] == "speed_kmh"
    assert analysis["output"]["normalization"] == "speed_fallback_no_grade"
    assert analysis["output"]["grade_source"] == "speed_fallback"
    assert "grade_unavailable_speed_fallback" in analysis["decision"]["reasons"]


def test_native_grade_takes_priority_when_available():
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_run_activity(start_time=start, temp=11.0, rpe=4.0, with_native_grade=True)
    engine = StubFormAnalysisEngine([])

    grade_ctx = engine._resolve_grade_series(
        activity.streams,
        "run",
        {"location": "Outdoor"},
    )

    assert grade_ctx["source"] == "native_fit"
    assert grade_ctx["quality"] in {"high", "medium"}


def test_3_reps_intervals_produces_result():
    """Issue 4: intervals with exactly 3 reps should now produce a result."""
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    seconds = 2400  # 40 min
    power = []
    hr = []
    for idx in range(seconds):
        rep_idx = idx // 480
        in_rep = idx % 480
        if rep_idx < 3 and in_rep < 400:
            power.append(260.0)
            hr.append(145.0 + min(in_rep / 60.0, 5.0))
        else:
            power.append(120.0)
            hr.append(120.0)

    df = pd.DataFrame(
        {
            "timestamp": pd.date_range(start=start, periods=seconds, freq="s"),
            "power": power,
            "heart_rate": hr,
            "temperature": [18.0] * seconds,
        }
    )
    meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="3x6'40 tempo",
        source_sport="Bike",
        start_time=start,
        duration_sec=seconds,
        rpe=5.0,
        temp_avg=18.0,
        work_type="intervals",
    )
    activity = Activity(metadata=meta, streams=df)
    interval_details = [
        {"status": "matched", "start_index": 60 + idx * 480, "end_index": 60 + idx * 480 + 400, "duration_sec": 400}
        for idx in range(3)
    ]
    engine = StubFormAnalysisEngine([])
    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
        interval_details=interval_details,
    )
    assert analysis is not None
    assert analysis["module"] == "intervals"
    assert analysis["template"]["rep_count"] == 3


def test_35_min_continuous_produces_result():
    """Issue 3: a 35 min continuous activity should now be analyzed with window 10-30."""
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    seconds = 35 * 60  # 35 min
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range(start=start, periods=seconds, freq="s"),
            "power": [200.0] * seconds,
            "heart_rate": [150.0] * seconds,
            "temperature": [20.0] * seconds,
        }
    )
    meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="Tempo court",
        source_sport="Bike",
        start_time=start,
        duration_sec=seconds,
        rpe=4.0,
        temp_avg=20.0,
        work_type="endurance",
    )
    activity = Activity(metadata=meta, streams=df)
    engine = StubFormAnalysisEngine([])
    analysis = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )
    assert analysis is not None
    assert analysis["module"] == "continuous_tempo"
    assert analysis["stable_segment"]["window_label"] == "10-30"


def test_output_filter_excludes_beyond_3_percent():
    """Issue 2: OUTPUT_COMPARABLE_MAX_TOLERANCE ±3% should filter baselines."""
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    activity = make_bike_activity(start_time=start, temp=20.0, rpe=4.0, power=200.0, hr=150.0)
    engine = StubFormAnalysisEngine([])

    first_pass = engine.analyze(
        activity_id=None,
        athlete_id="athlete-1",
        activity=activity,
        metrics_dict={},
    )
    template_key = first_pass["template_key"]
    output_mean = first_pass["output"]["mean"]

    # Row with output at 210W — should be excluded (>3% from ~200W)
    excluded_row = build_comparable_row(
        session_date=start - timedelta(days=1),
        template_key=template_key,
        module="continuous_tempo",
        temp=20.0,
        hr_corr=150.0,
        output_mean=210.0,
        ea_today=1.33,
        dec_today=1.0,
        rpe=5.0,
    )
    # Row with output at 204W — should be included (<3% from ~200W)
    included_row = build_comparable_row(
        session_date=start - timedelta(days=2),
        template_key=template_key,
        module="continuous_tempo",
        temp=20.0,
        hr_corr=150.0,
        output_mean=output_mean * 1.02,
        ea_today=1.33,
        dec_today=1.0,
        rpe=5.0,
    )

    matched = engine._filter_matching_rows(
        rows=[excluded_row, included_row],
        template_key=template_key,
        module="continuous_tempo",
        duration_sec=1800.0,
        output_mean=output_mean,
        current_temp=20.0,
        comparison_mode="same_temp_bin",
    )
    ids = [r.id for r in matched]
    assert excluded_row.id not in ids
    assert included_row.id in ids


def test_segment_temperature_preferred_over_activity():
    """Issue 5: segment temp should take priority over activity-level temp."""
    start = datetime(2026, 3, 17, tzinfo=timezone.utc)
    seconds = 100
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range(start=start, periods=seconds, freq="s"),
            "temperature": [15.0] * seconds,
        }
    )
    meta = ActivityMetadata(
        activity_type="Bike",
        activity_name="Test",
        source_sport="Bike",
        start_time=start,
        duration_sec=seconds,
        temp_avg=18.0,
        work_type="endurance",
    )
    activity = Activity(metadata=meta, streams=df)
    segment_df = pd.DataFrame({"temperature": [15.0] * 50})

    # With segment_df, should use segment temp (15°C), not activity metadata (18°C)
    temp = _extract_current_temperature(activity, segment_df=segment_df)
    assert temp == 15.0

    # Without segment_df, should fallback to metadata (18°C)
    temp_fallback = _extract_current_temperature(activity)
    assert temp_fallback == 18.0
