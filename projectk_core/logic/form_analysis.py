from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from statistics import median
from typing import Any, Dict, List, Optional
import math
import re

import numpy as np
import pandas as pd

from projectk_core.logic.models import Activity


SOT_VERSION = "karo_pdf_2026_03_20"
MIN_BETA_SAMPLES = 8
MAX_BETA_SAMPLES = 20
MIN_BASELINE_SESSIONS = 5
MAX_BASELINE_SESSIONS = 8
TEMP_BIN_WIDTH_C = 2.0
OUTPUT_STABLE_TOLERANCE = 0.03
OUTPUT_COMPARABLE_MAX_TOLERANCE = 0.08
LOW_GRADE_THRESHOLD = 0.02
MAX_GRADE_ABS = 0.40
GRADE_WINDOW_M = 40.0
GRADE_HALF_WINDOW_M = GRADE_WINDOW_M / 2.0
GRADE_GRID_STEP_M = 5.0
GRADE_MIN_EFFECTIVE_SPAN_M = 28.0
GRADE_ACTIVE_SPEED_THRESHOLD = 1.5
GRADE_MIN_INPUT_COVERAGE = 0.80
GRADE_HIGH_COVERAGE = 0.90
GRADE_MEDIUM_COVERAGE = 0.75
DEGRADED_CONFIDENCE_PENALTY = 0.12

ABNORMAL_FEELING_PATTERNS = [
    r"jambes?\s+vides?",
    r"motivation\s+(?:down|basse|faible)",
    r"sensation\s+anorm",
    r"fatigu",
    r"\bepuis",
    r"\bépuis",
    r"\bpas\s+de\s+jambes",
]


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        result = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(result):
        return None
    return result


def _safe_round(value: Optional[float], digits: int = 3) -> Optional[float]:
    return round(value, digits) if value is not None else None


def _median(values: List[float]) -> Optional[float]:
    cleaned = [v for v in values if v is not None and math.isfinite(v)]
    return float(median(cleaned)) if cleaned else None


def _compute_slope(xs: List[float], ys: List[float]) -> Optional[float]:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    x = np.array(xs, dtype=float)
    y = np.array(ys, dtype=float)
    x_mean = float(x.mean())
    denom = float(((x - x_mean) ** 2).sum())
    if denom <= 0:
        return None
    slope = float(((x - x_mean) * (y - float(y.mean()))).sum() / denom)
    return slope


def _normalize_sport(activity_type: str) -> str:
    from projectk_core.logic.sport_mapper import normalize_sport_lower
    return normalize_sport_lower(activity_type or "")


def _infer_location(activity: Activity) -> str:
    raw = " ".join(
        filter(
            None,
            [
                activity.metadata.activity_type,
                activity.metadata.activity_name,
                activity.metadata.source_sport,
            ],
        )
    ).lower()
    sport = _normalize_sport(activity.metadata.activity_type)

    if "home trainer" in raw:
        return "Indoor (HT)"
    if "tapis" in raw:
        return "Indoor (Tapis)"
    if sport in {"swim", "strength"}:
        return "Indoor"
    if sport in {"run", "bike", "ski"}:
        return "Outdoor"
    return "Unknown"


def _infer_environment(activity: Activity, grade_series: Optional[pd.Series] = None) -> Dict[str, str]:
    location = _infer_location(activity)
    terrain = "unknown"
    if location.startswith("Indoor"):
        terrain = "indoor"
    else:
        sport = _normalize_sport(activity.metadata.activity_type)
        if grade_series is None:
            df = activity.streams
            if sport in {"run", "bike"} and not df.empty and "grade" in df.columns:
                grade_series = pd.to_numeric(df["grade"], errors="coerce")
        grade = grade_series.dropna() if isinstance(grade_series, pd.Series) else pd.Series(dtype=float)
        if not grade.empty:
            grade = grade.clip(-MAX_GRADE_ABS, MAX_GRADE_ABS)
            steep_share = float((grade.abs() >= LOW_GRADE_THRESHOLD).mean())
            if steep_share <= 0.10:
                terrain = "flat"
            elif steep_share <= 0.35:
                terrain = "rolling"
            else:
                terrain = "hilly"

    return {"location": location, "terrain": terrain}


def _get_gap_factor(grade: pd.Series) -> pd.Series:
    g = grade.clip(-MAX_GRADE_ABS, MAX_GRADE_ABS)
    return -10.83 * (g ** 4) - 1.20 * (g ** 3) + 16.40 * (g ** 2) + 2.96 * g + 1.00


def _get_elapsed_seconds(df: pd.DataFrame) -> pd.Series:
    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        if ts.notna().any():
            start = ts.dropna().iloc[0]
            return (ts - start).dt.total_seconds().ffill().fillna(0)
    return pd.Series(np.arange(len(df), dtype=float), index=df.index)


def _has_abnormal_feeling(activity: Activity) -> bool:
    texts: List[str] = []
    source_json = activity.metadata.source_json or {}
    for key in ("description", "comment", "athlete_comment"):
        value = source_json.get(key)
        if isinstance(value, str):
            texts.append(value.lower())
    if activity.metadata.activity_name:
        texts.append(activity.metadata.activity_name.lower())

    combined = " ".join(texts)
    return any(re.search(pattern, combined) for pattern in ABNORMAL_FEELING_PATTERNS)


def _extract_current_temperature(
    activity: Activity,
    segment_df: Optional[pd.DataFrame] = None,
) -> Optional[float]:
    if segment_df is not None and "temperature" in segment_df.columns:
        values = pd.to_numeric(segment_df["temperature"], errors="coerce").dropna()
        if not values.empty:
            return float(values.mean())
    meta_temp = _safe_float(activity.metadata.temp_avg)
    if meta_temp is not None:
        return meta_temp
    df = activity.streams
    if "temperature" not in df.columns:
        return None
    values = pd.to_numeric(df["temperature"], errors="coerce").dropna()
    return float(values.mean()) if not values.empty else None


def _classify_grade_quality(coverage_pct: Optional[float]) -> str:
    if coverage_pct is None:
        return "low"
    if coverage_pct >= GRADE_HIGH_COVERAGE:
        return "high"
    if coverage_pct >= GRADE_MEDIUM_COVERAGE:
        return "medium"
    return "low"


@dataclass
class ComparableRow:
    id: str
    session_date: datetime
    duration_sec: Optional[float]
    rpe: Optional[float]
    temp_avg: Optional[float]
    form_analysis: Dict[str, Any]


class FormAnalysisEngine:
    def __init__(self, db_connector):
        self.db = db_connector

    def analyze(
        self,
        *,
        activity_id: Optional[str],
        athlete_id: str,
        activity: Activity,
        metrics_dict: Dict[str, Any],
        interval_details: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        work_type = (activity.metadata.work_type or "").lower()
        sport = _normalize_sport(activity.metadata.activity_type)
        if sport not in {"bike", "run"}:
            return None

        if work_type == "intervals":
            return self._analyze_intervals(
                activity_id=activity_id,
                athlete_id=athlete_id,
                activity=activity,
                metrics_dict=metrics_dict,
                interval_details=interval_details or [],
            )

        return self._analyze_continuous(
            activity_id=activity_id,
            athlete_id=athlete_id,
            activity=activity,
            metrics_dict=metrics_dict,
        )

    def _fetch_candidate_rows(
        self,
        *,
        athlete_id: str,
        session_date: datetime,
        sport: str,
        current_activity_id: Optional[str],
    ) -> List[ComparableRow]:
        result = (
            self.db.client.table("activities")
            .select("id, session_date, duration_sec, rpe, temp_avg, form_analysis, sport_type")
            .eq("athlete_id", athlete_id)
            .lt("session_date", session_date.isoformat())
            .order("session_date", desc=True)
            .limit(120)
            .execute()
        )

        rows: List[ComparableRow] = []
        for raw in result.data or []:
            if current_activity_id and raw.get("id") == current_activity_id:
                continue
            if _normalize_sport(raw.get("sport_type") or "") != sport:
                continue
            form_analysis = raw.get("form_analysis")
            if not isinstance(form_analysis, dict):
                continue
            session_ts = raw.get("session_date")
            if not session_ts:
                continue
            rows.append(
                ComparableRow(
                    id=raw["id"],
                    session_date=datetime.fromisoformat(session_ts.replace("Z", "+00:00")),
                    duration_sec=_safe_float(raw.get("duration_sec")),
                    rpe=_safe_float(raw.get("rpe")),
                    temp_avg=_safe_float(raw.get("temp_avg")),
                    form_analysis=form_analysis,
                )
            )
        return rows

    def _build_active_grade_mask(self, df: pd.DataFrame) -> pd.Series:
        mask = pd.Series(True, index=df.index, dtype=bool)
        if "speed" in df.columns:
            speed = pd.to_numeric(df["speed"], errors="coerce")
            mask &= speed > GRADE_ACTIVE_SPEED_THRESHOLD
        return mask

    def _build_grade_metadata(
        self,
        *,
        source: str,
        series: Optional[pd.Series],
        active_mask: pd.Series,
        coverage_pct: Optional[float],
        input_coverage_pct: Optional[float] = None,
    ) -> Dict[str, Any]:
        valid_points = int(series.where(active_mask).dropna().shape[0]) if isinstance(series, pd.Series) else 0
        return {
            "source": source,
            "series": series if isinstance(series, pd.Series) else pd.Series(np.nan, index=active_mask.index, dtype=float),
            "window_m": GRADE_WINDOW_M if source == "derived_altitude_distance" else None,
            "grid_step_m": GRADE_GRID_STEP_M if source == "derived_altitude_distance" else None,
            "coverage_pct": coverage_pct,
            "input_coverage_pct": input_coverage_pct,
            "valid_points": valid_points,
            "quality": _classify_grade_quality(coverage_pct),
        }

    def _resolve_grade_series(
        self,
        df: pd.DataFrame,
        sport: str,
        environment: Dict[str, str],
    ) -> Dict[str, Any]:
        active_mask = self._build_active_grade_mask(df)
        active_points = int(active_mask.sum())
        if active_points <= 0:
            active_mask = pd.Series(True, index=df.index, dtype=bool)
            active_points = len(df.index)

        native_grade = None
        if "grade" in df.columns:
            native_grade = pd.to_numeric(df["grade"], errors="coerce").clip(-MAX_GRADE_ABS, MAX_GRADE_ABS)
            native_valid = int(native_grade.where(active_mask).notna().sum())
            native_coverage = (native_valid / active_points) if active_points > 0 else None
            native_meta = self._build_grade_metadata(
                source="native_fit",
                series=native_grade,
                active_mask=active_mask,
                coverage_pct=native_coverage,
                input_coverage_pct=native_coverage,
            )
            if native_meta["quality"] in {"high", "medium"}:
                return native_meta

        if sport != "run" or environment.get("location", "").startswith("Indoor"):
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=0.0 if active_points > 0 else None,
            )

        if "distance" not in df.columns or "altitude" not in df.columns:
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=0.0 if active_points > 0 else None,
            )

        distance = pd.to_numeric(df["distance"], errors="coerce")
        altitude = pd.to_numeric(df["altitude"], errors="coerce")
        raw_mask = active_mask & distance.notna() & altitude.notna()
        input_coverage_pct = (int(raw_mask.sum()) / active_points) if active_points > 0 else None
        if input_coverage_pct is None or input_coverage_pct < GRADE_MIN_INPUT_COVERAGE:
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=input_coverage_pct,
                input_coverage_pct=input_coverage_pct,
            )

        base = pd.DataFrame({"distance": distance, "altitude": altitude}, index=df.index)
        base = base.loc[raw_mask].copy()
        if base.empty:
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=input_coverage_pct,
                input_coverage_pct=input_coverage_pct,
            )

        base["distance"] = base["distance"].cummax()
        base = base.groupby("distance", as_index=False)["altitude"].mean()
        if len(base) < 2:
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=input_coverage_pct,
                input_coverage_pct=input_coverage_pct,
            )

        min_distance = float(base["distance"].min())
        max_distance = float(base["distance"].max())
        if (max_distance - min_distance) < GRADE_WINDOW_M:
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=input_coverage_pct,
                input_coverage_pct=input_coverage_pct,
            )

        distance_grid = np.arange(min_distance, max_distance + GRADE_GRID_STEP_M, GRADE_GRID_STEP_M)
        altitude_grid = np.interp(distance_grid, base["distance"].to_numpy(dtype=float), base["altitude"].to_numpy(dtype=float))
        half_offset = int(GRADE_HALF_WINDOW_M / GRADE_GRID_STEP_M)
        grade_grid = np.full_like(distance_grid, np.nan, dtype=float)
        for idx in range(half_offset, len(distance_grid) - half_offset):
            left = idx - half_offset
            right = idx + half_offset
            span = distance_grid[right] - distance_grid[left]
            if span < GRADE_MIN_EFFECTIVE_SPAN_M:
                continue
            grade_grid[idx] = (altitude_grid[right] - altitude_grid[left]) / span

        interpolated = np.full(len(df.index), np.nan, dtype=float)
        valid_grade_grid = ~np.isnan(grade_grid)
        if not valid_grade_grid.any():
            return self._build_grade_metadata(
                source="speed_fallback",
                series=None,
                active_mask=active_mask,
                coverage_pct=0.0,
                input_coverage_pct=input_coverage_pct,
            )
        valid_distance_mask = raw_mask & distance.ge(distance_grid[half_offset]) & distance.le(distance_grid[-half_offset - 1])
        if valid_distance_mask.any():
            interpolated[valid_distance_mask.to_numpy()] = np.interp(
                distance.loc[valid_distance_mask].to_numpy(dtype=float),
                distance_grid[valid_grade_grid],
                grade_grid[valid_grade_grid],
            )
        derived_series = pd.Series(interpolated, index=df.index, dtype=float).clip(-MAX_GRADE_ABS, MAX_GRADE_ABS)
        derived_valid = int(derived_series.where(active_mask).notna().sum())
        derived_coverage = (derived_valid / active_points) if active_points > 0 else None
        derived_meta = self._build_grade_metadata(
            source="derived_altitude_distance",
            series=derived_series,
            active_mask=active_mask,
            coverage_pct=derived_coverage,
            input_coverage_pct=input_coverage_pct,
        )
        if derived_meta["quality"] in {"high", "medium"}:
            return derived_meta

        return self._build_grade_metadata(
            source="speed_fallback",
            series=None,
            active_mask=active_mask,
            coverage_pct=derived_coverage,
            input_coverage_pct=input_coverage_pct,
        )

    def _select_continuous_output(
        self,
        df: pd.DataFrame,
        sport: str,
        environment: Dict[str, str],
        grade_ctx: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if sport == "bike":
            if "power" not in df.columns:
                return {"metric": "power_w", "series": pd.Series(dtype=float), "unit": "W", "normalization": "power"}
            power = pd.to_numeric(df["power"], errors="coerce")
            return {
                "metric": "power_w",
                "series": power.where(power > 0),
                "unit": "W",
                "normalization": "power",
            }

        speed = pd.to_numeric(df["speed"], errors="coerce") if "speed" in df.columns else pd.Series(dtype=float)
        if environment["location"].startswith("Indoor"):
            return {
                "metric": "gap_speed_kmh",
                "series": speed.where(speed > 0) * 3.6,
                "unit": "km/h",
                "normalization": "speed",
            }

        grade_source = grade_ctx.get("source") if isinstance(grade_ctx, dict) else None
        grade_series = grade_ctx.get("series") if isinstance(grade_ctx, dict) else None
        if isinstance(grade_series, pd.Series) and grade_source in {"native_fit", "derived_altitude_distance"}:
            valid = speed.where(speed > 0)
            gap_factor = _get_gap_factor(grade_series)
            gap_speed = valid * gap_factor * 3.6
            low_grade_speed = gap_speed.where(grade_series.abs() < LOW_GRADE_THRESHOLD)
            return {
                "metric": "gap_speed_kmh",
                "series": low_grade_speed,
                "gap_factor": gap_factor,
                "unit": "km/h",
                "normalization": "gap_speed_native_grade" if grade_source == "native_fit" else "gap_speed_derived_grade",
                "grade_source": grade_source,
                "grade_window_m": grade_ctx.get("window_m"),
                "grade_grid_step_m": grade_ctx.get("grid_step_m"),
                "grade_coverage_pct": grade_ctx.get("coverage_pct"),
                "grade_valid_points": grade_ctx.get("valid_points"),
                "grade_quality": grade_ctx.get("quality"),
            }

        fallback_series = speed.where(speed > 0) * 3.6
        return {
            "metric": "speed_kmh",
            "series": fallback_series,
            "unit": "km/h",
            "normalization": "speed_fallback_no_grade",
            "grade_source": "speed_fallback",
            "grade_window_m": grade_ctx.get("window_m") if isinstance(grade_ctx, dict) else None,
            "grade_grid_step_m": grade_ctx.get("grid_step_m") if isinstance(grade_ctx, dict) else None,
            "grade_coverage_pct": grade_ctx.get("coverage_pct") if isinstance(grade_ctx, dict) else None,
            "grade_valid_points": grade_ctx.get("valid_points") if isinstance(grade_ctx, dict) else None,
            "grade_quality": grade_ctx.get("quality") if isinstance(grade_ctx, dict) else "low",
        }

    def _select_interval_output(
        self,
        df: pd.DataFrame,
        sport: str,
        environment: Dict[str, str],
        grade_ctx: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self._select_continuous_output(df, sport, environment, grade_ctx=grade_ctx)

    def _build_continuous_signature(
        self,
        *,
        sport: str,
        environment: Dict[str, str],
        segment_duration_sec: float,
        output_mean: float,
    ) -> Dict[str, Any]:
        if sport == "bike":
            band = round(output_mean / 5.0) * 5
        else:
            band = round(output_mean * 2.0) / 2.0

        template_key = "|".join(
            [
                sport,
                "continuous_tempo",
                environment["location"],
                environment["terrain"],
            ]
        )
        return {"template_key": template_key, "output_band": band}

    def _build_interval_signature(
        self,
        *,
        sport: str,
        environment: Dict[str, str],
        rep_count: int,
        rep_duration_sec: float,
        recovery_duration_sec: Optional[float],
        output_mean: float,
    ) -> Dict[str, Any]:
        rep_bucket = int(round(rep_duration_sec / 30.0) * 30)
        rec_bucket = int(round((recovery_duration_sec or 0.0) / 30.0) * 30)
        if sport == "bike":
            band = round(output_mean / 5.0) * 5
        else:
            band = round(output_mean * 2.0) / 2.0

        template_key = "|".join(
            [
                sport,
                "intervals",
                environment["location"],
                environment["terrain"],
                f"{rep_count}reps",
                f"{rep_bucket}s",
                f"{rec_bucket}s",
            ]
        )
        return {"template_key": template_key, "output_band": band}

    def _filter_matching_rows(
        self,
        *,
        rows: List[ComparableRow],
        template_key: str,
        module: str,
        duration_sec: float,
        output_mean: float,
        current_temp: Optional[float],
        comparison_mode: str,
    ) -> List[ComparableRow]:
        matched: List[ComparableRow] = []
        for row in rows:
            fa = row.form_analysis
            if fa.get("version") != SOT_VERSION:
                continue
            if fa.get("module") != module:
                continue
            if fa.get("template_key") != template_key:
                continue
            previous_duration = _safe_float(fa.get("template", {}).get("duration_sec")) or row.duration_sec
            if previous_duration and duration_sec:
                ratio = abs(previous_duration - duration_sec) / duration_sec
                if ratio > 0.15:
                    continue

            previous_output = _safe_float(fa.get("output", {}).get("mean"))
            if previous_output is not None and output_mean > 0:
                if abs(previous_output - output_mean) / output_mean > OUTPUT_COMPARABLE_MAX_TOLERANCE:
                    continue

            if comparison_mode == "same_temp_bin" and current_temp is not None:
                previous_temp = _safe_float(fa.get("temperature", {}).get("temp")) or row.temp_avg
                if previous_temp is None or abs(previous_temp - current_temp) > TEMP_BIN_WIDTH_C:
                    continue
            matched.append(row)
        return matched

    def _compute_temperature_context(
        self,
        *,
        current_temp: Optional[float],
        current_hr_raw: float,
        current_drift_raw: float,
        matched_rows: List[ComparableRow],
    ) -> Dict[str, Any]:
        rows_with_temp = [
            row
            for row in matched_rows
            if (_safe_float(row.form_analysis.get("temperature", {}).get("temp")) or row.temp_avg) is not None
            and _safe_float(row.form_analysis.get("temperature", {}).get("hr_mean_raw")) is not None
        ]
        regression_rows = rows_with_temp[:MAX_BETA_SAMPLES]

        comparison_mode = "same_temp_bin"
        beta_hr = None
        beta_drift = None
        tref = current_temp

        if current_temp is not None and len(regression_rows) >= MIN_BETA_SAMPLES:
            temps = [
                _safe_float(row.form_analysis.get("temperature", {}).get("temp")) or row.temp_avg
                for row in regression_rows
            ]
            hrs = [
                _safe_float(row.form_analysis.get("temperature", {}).get("hr_mean_raw"))
                for row in regression_rows
            ]
            drift_values = [
                _safe_float(row.form_analysis.get("decoupling", {}).get("raw"))
                for row in regression_rows
            ]
            if all(v is not None for v in temps) and all(v is not None for v in hrs):
                beta_hr = _compute_slope(temps, hrs)
                valid_drift_pairs = [
                    (temp, drift)
                    for temp, drift in zip(temps, drift_values)
                    if temp is not None and drift is not None
                ]
                if len(valid_drift_pairs) >= MIN_BETA_SAMPLES:
                    beta_drift = _compute_slope(
                        [pair[0] for pair in valid_drift_pairs],
                        [pair[1] for pair in valid_drift_pairs],
                    )
                tref = _median([*temps, current_temp])
                comparison_mode = "beta_regression" if beta_hr is not None else "same_temp_bin"

        hr_corr = current_hr_raw
        drift_corr = current_drift_raw
        if comparison_mode == "beta_regression" and current_temp is not None and tref is not None:
            if beta_hr is not None:
                hr_corr = current_hr_raw - beta_hr * (current_temp - tref)
            if beta_drift is not None:
                drift_corr = current_drift_raw - beta_drift * (current_temp - tref)

        return {
            "comparison_mode": comparison_mode,
            "beta_hr": beta_hr,
            "beta_drift": beta_drift,
            "tref": tref,
            "hr_corr": hr_corr,
            "drift_corr": drift_corr,
            "comparable_count": len(matched_rows),
        }

    def _collect_baseline_rows(
        self,
        *,
        matched_rows: List[ComparableRow],
        limit: int = MAX_BASELINE_SESSIONS,
    ) -> List[ComparableRow]:
        return matched_rows[:limit]

    def _compute_confidence(
        self,
        *,
        comparable_count: int,
        baseline_count: int,
        comparison_mode: str,
        has_rpe: bool,
        degraded_output: bool = False,
    ) -> float:
        score = 0.35
        score += min(comparable_count, 20) * 0.02
        score += min(baseline_count, 8) * 0.03
        if comparison_mode == "beta_regression":
            score += 0.12
        if has_rpe:
            score += 0.08
        if degraded_output:
            score -= DEGRADED_CONFIDENCE_PENALTY
        return round(min(score, 0.98), 2)

    def _analyze_continuous(
        self,
        *,
        activity_id: Optional[str],
        athlete_id: str,
        activity: Activity,
        metrics_dict: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        df = activity.streams.copy()
        if df.empty or "heart_rate" not in df.columns:
            return None

        sport = _normalize_sport(activity.metadata.activity_type)
        base_environment = {"location": _infer_location(activity)}
        grade_ctx = self._resolve_grade_series(df, sport, base_environment)
        environment = _infer_environment(activity, grade_ctx.get("series"))
        output_ctx = self._select_continuous_output(df, sport, environment, grade_ctx=grade_ctx)
        output_series = output_ctx["series"]
        if output_series.empty:
            return {
                "version": SOT_VERSION,
                "module": "continuous_tempo",
                "template_key": None,
                "environment": environment,
                "decision": {
                    "global": "historique_insuffisant",
                    "module": "historique_insuffisant",
                    "final": "historique_insuffisant",
                    "durability_flag": False,
                    "reasons": ["slope_normalization_unavailable"],
                },
                "confidence": 0.2,
            }

        df = df.assign(
            heart_rate=pd.to_numeric(df["heart_rate"], errors="coerce"),
            output_value=output_series,
            elapsed_sec=_get_elapsed_seconds(df),
        )
        window = None
        max_elapsed = float(df["elapsed_sec"].max())
        if max_elapsed >= 50 * 60:
            window = (20 * 60, 50 * 60, "20-50")
        elif max_elapsed >= 45 * 60:
            window = (15 * 60, 45 * 60, "15-45")
        elif max_elapsed >= 30 * 60:
            window = (10 * 60, min(max_elapsed, 30 * 60), "10-30")
        else:
            return None

        segment = df[(df["elapsed_sec"] >= window[0]) & (df["elapsed_sec"] <= window[1])].copy()
        segment = segment.dropna(subset=["heart_rate", "output_value"])
        segment = segment[segment["output_value"] > 0]
        segment_duration = float(segment["elapsed_sec"].max() - segment["elapsed_sec"].min())
        if segment_duration < 300:
            return None

        median_output = float(segment["output_value"].median())
        stable = segment[
            (segment["output_value"] >= median_output * (1.0 - OUTPUT_STABLE_TOLERANCE))
            & (segment["output_value"] <= median_output * (1.0 + OUTPUT_STABLE_TOLERANCE))
        ].copy()
        stable_duration = float(stable["elapsed_sec"].max() - stable["elapsed_sec"].min())
        if stable_duration < 180:
            return None

        half = len(stable) // 2
        half_duration = float(stable.iloc[half:]["elapsed_sec"].min() - stable.iloc[:half]["elapsed_sec"].min())
        if half_duration < 120:
            return None

        first_half = stable.iloc[:half]
        second_half = stable.iloc[half:]
        current_temp = _extract_current_temperature(activity, segment_df=stable)
        hr_mean_raw = float(stable["heart_rate"].mean())
        output_mean = float(stable["output_value"].mean())
        ea_first_raw = float(first_half["output_value"].mean() / first_half["heart_rate"].mean())
        ea_second_raw = float(second_half["output_value"].mean() / second_half["heart_rate"].mean())
        ea_today_raw = float(output_mean / hr_mean_raw) if hr_mean_raw > 0 else None
        dec_raw = ((ea_second_raw / ea_first_raw) - 1.0) * 100.0 if ea_first_raw > 0 else 0.0

        signature = self._build_continuous_signature(
            sport=sport,
            environment=environment,
            segment_duration_sec=float(stable["elapsed_sec"].max() - stable["elapsed_sec"].min()),
            output_mean=output_mean,
        )

        candidates = self._fetch_candidate_rows(
            athlete_id=athlete_id,
            session_date=activity.metadata.start_time,
            sport=sport,
            current_activity_id=activity_id,
        )
        preliminary = self._filter_matching_rows(
            rows=candidates,
            template_key=signature["template_key"],
            module="continuous_tempo",
            duration_sec=float(stable["elapsed_sec"].max() - stable["elapsed_sec"].min()),
            output_mean=output_mean,
            current_temp=current_temp,
            comparison_mode="beta_regression",
        )
        temperature_ctx = self._compute_temperature_context(
            current_temp=current_temp,
            current_hr_raw=hr_mean_raw,
            current_drift_raw=dec_raw,
            matched_rows=preliminary,
        )
        matched_rows = self._filter_matching_rows(
            rows=candidates,
            template_key=signature["template_key"],
            module="continuous_tempo",
            duration_sec=float(stable["elapsed_sec"].max() - stable["elapsed_sec"].min()),
            output_mean=output_mean,
            current_temp=current_temp,
            comparison_mode=temperature_ctx["comparison_mode"],
        )
        temperature_ctx = self._compute_temperature_context(
            current_temp=current_temp,
            current_hr_raw=hr_mean_raw,
            current_drift_raw=dec_raw,
            matched_rows=matched_rows,
        )

        correction = hr_mean_raw - temperature_ctx["hr_corr"]
        hr_first_corr = float(first_half["heart_rate"].mean()) - correction
        hr_second_corr = float(second_half["heart_rate"].mean()) - correction
        ea_first = float(first_half["output_value"].mean() / hr_first_corr) if hr_first_corr > 0 else None
        ea_second = float(second_half["output_value"].mean() / hr_second_corr) if hr_second_corr > 0 else None
        ea_today = float(output_mean / temperature_ctx["hr_corr"]) if temperature_ctx["hr_corr"] > 0 else None
        dec_today = ((ea_second / ea_first) - 1.0) * 100.0 if ea_first and ea_first > 0 else temperature_ctx["drift_corr"]

        baseline_rows = self._collect_baseline_rows(matched_rows=matched_rows)
        baseline_ea_values: List[float] = []
        baseline_dec_values: List[float] = []
        baseline_hr_values: List[float] = []
        baseline_output_values: List[float] = []
        baseline_rpe_values: List[float] = []
        degradation_history = 0

        for row in baseline_rows:
            fa = row.form_analysis
            ea_val = _safe_float(fa.get("ea", {}).get("today"))
            dec_val = _safe_float(fa.get("decoupling", {}).get("today"))
            hr_val = _safe_float(fa.get("temperature", {}).get("hr_corr")) or _safe_float(
                fa.get("temperature", {}).get("hr_mean_raw")
            )
            output_val = _safe_float(fa.get("output", {}).get("mean"))
            rpe_val = _safe_float(fa.get("rpe", {}).get("today"))
            if ea_val is not None:
                baseline_ea_values.append(ea_val)
            if dec_val is not None:
                baseline_dec_values.append(dec_val)
            if hr_val is not None:
                baseline_hr_values.append(hr_val)
            if output_val is not None:
                baseline_output_values.append(output_val)
            if rpe_val is not None:
                baseline_rpe_values.append(rpe_val)
            ea_delta_prev = _safe_float(fa.get("ea", {}).get("delta_pct"))
            dec_delta_prev = _safe_float(fa.get("decoupling", {}).get("delta"))
            if ea_delta_prev is not None and dec_delta_prev is not None and ea_delta_prev <= -2 and dec_delta_prev >= 2:
                degradation_history += 1

        baseline_count = len(baseline_rows)
        ea_base = _median(baseline_ea_values)
        dec_base = _median(baseline_dec_values)
        hr_base = _median(baseline_hr_values)
        output_base = _median(baseline_output_values)
        rpe_base = _median(baseline_rpe_values)
        ea_delta = ((ea_today - ea_base) / ea_base * 100.0) if ea_today is not None and ea_base else None
        dec_delta = (dec_today - dec_base) if dec_base is not None else None
        hr_delta = (temperature_ctx["hr_corr"] - hr_base) if hr_base is not None else None
        current_rpe = _safe_float(activity.metadata.rpe)
        rpe_delta = (current_rpe - rpe_base) if current_rpe is not None and rpe_base is not None else None
        output_delta = ((output_mean - output_base) / output_base * 100.0) if output_base else None
        output_stable = abs(output_delta or 0.0) <= (OUTPUT_STABLE_TOLERANCE * 100.0) if output_delta is not None else False
        output_down = (output_delta or 0.0) <= -(OUTPUT_STABLE_TOLERANCE * 100.0)
        drift_up_net = (dec_delta or 0.0) >= 2.0 if dec_delta is not None else False
        abnormal_feeling = _has_abnormal_feeling(activity)
        rpe_available = current_rpe is not None and rpe_base is not None

        module_decision = "historique_insuffisant"
        module_reasons: List[str] = []
        if baseline_count >= MIN_BASELINE_SESSIONS and ea_delta is not None and dec_delta is not None:
            if ea_delta >= 2.0 and dec_delta <= 0 and (not rpe_available or (rpe_delta is not None and rpe_delta <= 0)):
                module_decision = "progression_tempo"
                module_reasons.append("ea_up_dec_stable")
            elif ea_delta <= -2.0 and dec_delta >= 2.0 and degradation_history >= 1:
                module_decision = "degradation_tendance"
                module_reasons.append("negative_trend_repeated")
            elif ((dec_delta > 2.0) or (ea_delta < 0)) and rpe_available and rpe_delta is not None and rpe_delta >= 1:
                module_decision = "fatigue_stress"
                module_reasons.append("dec_or_ea_with_rpe_up")
            elif dec_delta > 2.0:
                module_decision = "fatigue_stress"
                module_reasons.append("dec_up")

        global_decision = "historique_insuffisant"
        global_reasons: List[str] = []
        if baseline_count >= MIN_BASELINE_SESSIONS and hr_delta is not None:
            if hr_delta <= -3 and rpe_delta is not None and rpe_delta <= -1 and output_stable:
                global_decision = "amelioration"
                global_reasons.append("hrcorr_down_rpe_down_output_stable")
            elif hr_delta >= 3 and rpe_delta is not None and rpe_delta >= 1:
                global_decision = "fatigue_stress"
                global_reasons.append("hrcorr_up_rpe_up")
            elif hr_delta <= -3 and rpe_delta is not None and rpe_delta >= 1 and (output_down or drift_up_net or abnormal_feeling):
                global_decision = "signal_alarme"
                global_reasons.append("low_hr_high_rpe_pattern")
            else:
                global_decision = "stable"

        durability_flag = dec_delta is not None and dec_delta >= 2.0
        final_decision = global_decision
        final_reasons = [*global_reasons, *module_reasons]
        if output_ctx.get("normalization") == "speed_fallback_no_grade":
            final_reasons.append("grade_unavailable_speed_fallback")
        if final_decision == "amelioration" and durability_flag:
            final_decision = "amelioration_fragile"
            final_reasons.append("durability_flag")
        elif final_decision == "fatigue_stress" and durability_flag:
            final_decision = "fatigue_confirmee"
            final_reasons.append("durability_flag")
        elif final_decision == "signal_alarme" and durability_flag:
            final_decision = "alerte_renforcee"
            final_reasons.append("durability_flag")

        return {
            "version": SOT_VERSION,
            "module": "continuous_tempo",
            "template_key": signature["template_key"],
            "template": {
                "duration_sec": _safe_round(float(stable["elapsed_sec"].max() - stable["elapsed_sec"].min()), 1),
                "output_band": signature["output_band"],
            },
            "comparable_count": len(matched_rows),
            "comparison_mode": temperature_ctx["comparison_mode"],
            "environment": environment,
            "stable_segment": {
                "window_label": window[2],
                "start_sec": window[0],
                "end_sec": window[1],
                "selected_points": int(len(stable)),
            },
            "temperature": {
                "temp": _safe_round(current_temp, 2),
                "tref": _safe_round(temperature_ctx["tref"], 2),
                "beta_hr": _safe_round(temperature_ctx["beta_hr"], 4),
                "beta_drift": _safe_round(temperature_ctx["beta_drift"], 4),
                "hr_mean_raw": _safe_round(hr_mean_raw, 2),
                "hr_corr": _safe_round(temperature_ctx["hr_corr"], 2),
                "drift_raw": _safe_round(dec_raw, 3),
                "drift_corr": _safe_round(dec_today, 3),
                "hr_corr_baseline": _safe_round(hr_base, 2),
                "delta_hr_corr": _safe_round(hr_delta, 2),
                "temp_bin_width_c": TEMP_BIN_WIDTH_C,
            },
            "output": {
                "metric": output_ctx["metric"],
                "mean": _safe_round(output_mean, 3),
                "baseline": _safe_round(output_base, 3),
                "delta_pct": _safe_round(output_delta, 2),
                "unit": output_ctx["unit"],
                "stable": output_stable,
                "tolerance_pct": OUTPUT_STABLE_TOLERANCE * 100.0,
                "normalization": output_ctx.get("normalization"),
                "grade_source": output_ctx.get("grade_source"),
                "grade_window_m": _safe_round(_safe_float(output_ctx.get("grade_window_m")), 1),
                "grade_grid_step_m": _safe_round(_safe_float(output_ctx.get("grade_grid_step_m")), 1),
                "grade_coverage_pct": _safe_round(_safe_float(output_ctx.get("grade_coverage_pct")), 3),
                "grade_valid_points": output_ctx.get("grade_valid_points"),
                "grade_quality": output_ctx.get("grade_quality"),
            },
            "ea": {
                "today": _safe_round(ea_today, 4),
                "baseline": _safe_round(ea_base, 4),
                "delta_pct": _safe_round(ea_delta, 2),
                "first_half": _safe_round(ea_first, 4),
                "second_half": _safe_round(ea_second, 4),
            },
            "decoupling": {
                "metric": "dec_pct",
                "raw": _safe_round(dec_raw, 3),
                "today": _safe_round(dec_today, 3),
                "baseline": _safe_round(dec_base, 3),
                "delta": _safe_round(dec_delta, 3),
            },
            "hrend_drift": None,
            "rpe": {
                "today": current_rpe,
                "baseline": _safe_round(rpe_base, 2),
                "delta": _safe_round(rpe_delta, 2),
                "available": current_rpe is not None,
            },
            "decision": {
                "global": global_decision,
                "module": module_decision,
                "final": final_decision,
                "durability_flag": durability_flag,
                "reasons": final_reasons or ["historique_insuffisant"],
            },
            "confidence": self._compute_confidence(
                comparable_count=len(matched_rows),
                baseline_count=baseline_count,
                comparison_mode=temperature_ctx["comparison_mode"],
                has_rpe=current_rpe is not None,
                degraded_output=output_ctx.get("normalization") == "speed_fallback_no_grade",
            ),
        }

    def _normalize_interval_details(self, interval_details: List[Dict[str, Any]]) -> List[Dict[str, float]]:
        reps: List[Dict[str, float]] = []
        for idx, detail in enumerate(interval_details):
            if detail.get("status") not in (None, "matched"):
                continue
            start = _safe_float(detail.get("start_index") or detail.get("start_time"))
            end = _safe_float(detail.get("end_index") or detail.get("end_time"))
            duration = _safe_float(detail.get("duration_sec") or detail.get("duration"))
            if start is None or end is None or duration is None or duration <= 0:
                continue
            reps.append({"start_sec": start, "end_sec": end, "duration_sec": duration, "index": float(idx + 1)})
        reps.sort(key=lambda item: item["start_sec"])
        return reps

    def _window_duration_for_rep(self, duration_sec: float) -> float:
        if duration_sec >= 6 * 60:
            return 120.0
        if duration_sec >= 3 * 60:
            return 90.0
        return 60.0

    def _analyze_intervals(
        self,
        *,
        activity_id: Optional[str],
        athlete_id: str,
        activity: Activity,
        metrics_dict: Dict[str, Any],
        interval_details: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        df = activity.streams.copy()
        if df.empty or "heart_rate" not in df.columns:
            return None

        sport = _normalize_sport(activity.metadata.activity_type)
        base_environment = {"location": _infer_location(activity)}
        grade_ctx = self._resolve_grade_series(df, sport, base_environment)
        environment = _infer_environment(activity, grade_ctx.get("series"))
        reps = self._normalize_interval_details(interval_details)
        if len(reps) < 3:
            return None

        df = df.assign(
            elapsed_sec=_get_elapsed_seconds(df),
            heart_rate=pd.to_numeric(df["heart_rate"], errors="coerce"),
        )
        output_ctx = self._select_interval_output(df, sport, environment, grade_ctx=grade_ctx)
        if output_ctx["series"].empty:
            return None
        df = df.assign(output_value=output_ctx["series"])

        rep_windows: List[Dict[str, Any]] = []
        hr_window_values: List[float] = []
        output_window_values: List[float] = []
        for rep in reps:
            window_dur = min(self._window_duration_for_rep(rep["duration_sec"]), rep["duration_sec"])
            start_sec = rep["end_sec"] - window_dur
            window_df = df[(df["elapsed_sec"] >= start_sec) & (df["elapsed_sec"] <= rep["end_sec"])].copy()
            window_df = window_df.dropna(subset=["heart_rate", "output_value"])
            window_df = window_df[window_df["output_value"] > 0]
            if len(window_df) < max(20, int(window_dur * 0.5)):
                continue
            hr_value = float(window_df["heart_rate"].mean())
            output_value = float(window_df["output_value"].mean())
            hr_window_values.append(hr_value)
            output_window_values.append(output_value)
            rep_windows.append(
                {
                    "rep_index": int(rep["index"]),
                    "start_sec": _safe_round(start_sec, 1),
                    "end_sec": _safe_round(rep["end_sec"], 1),
                    "duration_sec": _safe_round(window_dur, 1),
                    "hr_raw": _safe_round(hr_value, 2),
                    "output": _safe_round(output_value, 3),
                }
            )

        if len(rep_windows) < 3:
            return None

        rep_segment_dfs = []
        for rw in rep_windows:
            rw_df = df[(df["elapsed_sec"] >= rw["start_sec"]) & (df["elapsed_sec"] <= rw["end_sec"])]
            rep_segment_dfs.append(rw_df)
        combined_rep_df = pd.concat(rep_segment_dfs) if rep_segment_dfs else None
        current_temp = _extract_current_temperature(activity, segment_df=combined_rep_df)
        hr_mean_raw = float(np.mean(hr_window_values))
        output_mean = float(np.mean(output_window_values))
        ea_raw_values = [out / hr for out, hr in zip(output_window_values, hr_window_values) if hr > 0]
        if len(ea_raw_values) < 3:
            return None
        ea_first_raw = float(np.mean(ea_raw_values[:2]))
        ea_last_raw = float(np.mean(ea_raw_values[-2:]))
        dec_int_raw = ((ea_last_raw / ea_first_raw) - 1.0) * 100.0 if ea_first_raw > 0 else 0.0

        recovery_duration = None
        if len(reps) > 1:
            recovery_values = []
            for prev, nxt in zip(reps, reps[1:]):
                recovery_values.append(max(0.0, nxt["start_sec"] - prev["end_sec"]))
            recovery_duration = float(np.median(recovery_values)) if recovery_values else None

        signature = self._build_interval_signature(
            sport=sport,
            environment=environment,
            rep_count=len(rep_windows),
            rep_duration_sec=float(np.median([window["duration_sec"] for window in rep_windows])),
            recovery_duration_sec=recovery_duration,
            output_mean=output_mean,
        )

        candidates = self._fetch_candidate_rows(
            athlete_id=athlete_id,
            session_date=activity.metadata.start_time,
            sport=sport,
            current_activity_id=activity_id,
        )
        preliminary = self._filter_matching_rows(
            rows=candidates,
            template_key=signature["template_key"],
            module="intervals",
            duration_sec=float(np.median([rep["duration_sec"] for rep in rep_windows])),
            output_mean=output_mean,
            current_temp=current_temp,
            comparison_mode="beta_regression",
        )
        temperature_ctx = self._compute_temperature_context(
            current_temp=current_temp,
            current_hr_raw=hr_mean_raw,
            current_drift_raw=dec_int_raw,
            matched_rows=preliminary,
        )
        matched_rows = self._filter_matching_rows(
            rows=candidates,
            template_key=signature["template_key"],
            module="intervals",
            duration_sec=float(np.median([rep["duration_sec"] for rep in rep_windows])),
            output_mean=output_mean,
            current_temp=current_temp,
            comparison_mode=temperature_ctx["comparison_mode"],
        )
        temperature_ctx = self._compute_temperature_context(
            current_temp=current_temp,
            current_hr_raw=hr_mean_raw,
            current_drift_raw=dec_int_raw,
            matched_rows=matched_rows,
        )

        correction = hr_mean_raw - temperature_ctx["hr_corr"]
        hr_corr_values = [hr - correction for hr in hr_window_values]
        ea_values = [out / hr for out, hr in zip(output_window_values, hr_corr_values) if hr > 0]
        for idx, hr_corr in enumerate(hr_corr_values):
            rep_windows[idx]["hr_corr"] = _safe_round(hr_corr, 2)
            rep_windows[idx]["ea"] = _safe_round(ea_values[idx], 4) if idx < len(ea_values) else None

        ea_first = float(np.mean(ea_values[:2]))
        ea_last = float(np.mean(ea_values[-2:]))
        ea_mean = float(np.mean(ea_values))
        dec_int = ((ea_last / ea_first) - 1.0) * 100.0 if ea_first > 0 else 0.0
        hrend_drift = float(hr_corr_values[-1] - hr_corr_values[0])

        baseline_rows = self._collect_baseline_rows(matched_rows=matched_rows)
        baseline_ea_first_values: List[float] = []
        baseline_ea_mean_values: List[float] = []
        baseline_dec_values: List[float] = []
        baseline_hrend_values: List[float] = []
        baseline_hr_values: List[float] = []
        baseline_output_values: List[float] = []
        baseline_rpe_values: List[float] = []

        for row in baseline_rows:
            fa = row.form_analysis
            baseline_ea_first = _safe_float(fa.get("ea", {}).get("first_pair"))
            baseline_ea_mean = _safe_float(fa.get("ea", {}).get("today"))
            baseline_dec = _safe_float(fa.get("decoupling", {}).get("today"))
            baseline_hrend = _safe_float(fa.get("hrend_drift", {}).get("today"))
            hr_val = _safe_float(fa.get("temperature", {}).get("hr_corr")) or _safe_float(
                fa.get("temperature", {}).get("hr_mean_raw")
            )
            output_val = _safe_float(fa.get("output", {}).get("mean"))
            rpe_val = _safe_float(fa.get("rpe", {}).get("today"))
            if baseline_ea_first is not None:
                baseline_ea_first_values.append(baseline_ea_first)
            if baseline_ea_mean is not None:
                baseline_ea_mean_values.append(baseline_ea_mean)
            if baseline_dec is not None:
                baseline_dec_values.append(baseline_dec)
            if baseline_hrend is not None:
                baseline_hrend_values.append(baseline_hrend)
            if hr_val is not None:
                baseline_hr_values.append(hr_val)
            if output_val is not None:
                baseline_output_values.append(output_val)
            if rpe_val is not None:
                baseline_rpe_values.append(rpe_val)

        baseline_count = len(baseline_rows)
        ea_first_base = _median(baseline_ea_first_values)
        ea_mean_base = _median(baseline_ea_mean_values)
        dec_base = _median(baseline_dec_values)
        hrend_base = _median(baseline_hrend_values)
        hr_base = _median(baseline_hr_values)
        output_base = _median(baseline_output_values)
        rpe_base = _median(baseline_rpe_values)

        ea_first_delta = ((ea_first - ea_first_base) / ea_first_base * 100.0) if ea_first_base else None
        ea_mean_delta = ((ea_mean - ea_mean_base) / ea_mean_base * 100.0) if ea_mean_base else None
        dec_delta = dec_int - dec_base if dec_base is not None else None
        hrend_delta = hrend_drift - hrend_base if hrend_base is not None else None
        hr_delta = temperature_ctx["hr_corr"] - hr_base if hr_base is not None else None
        output_delta = ((output_mean - output_base) / output_base * 100.0) if output_base else None
        output_stable = abs(output_delta or 0.0) <= (OUTPUT_STABLE_TOLERANCE * 100.0) if output_delta is not None else False
        output_down = (output_delta or 0.0) <= -(OUTPUT_STABLE_TOLERANCE * 100.0)
        current_rpe = _safe_float(activity.metadata.rpe)
        rpe_delta = (current_rpe - rpe_base) if current_rpe is not None and rpe_base is not None else None
        rpe_available = current_rpe is not None and rpe_base is not None
        abnormal_feeling = _has_abnormal_feeling(activity)
        drift_up_net = bool((dec_delta is not None and dec_delta >= 2.0) or (hrend_delta is not None and hrend_delta >= 3.0))

        module_decision = "historique_insuffisant"
        module_reasons: List[str] = []
        if baseline_count >= MIN_BASELINE_SESSIONS:
            ea_reference_delta = ea_first_delta if ea_first_delta is not None else ea_mean_delta
            if (
                ea_reference_delta is not None
                and ea_reference_delta > 0
                and ((dec_delta is not None and dec_delta < 0) or (hrend_delta is not None and hrend_delta < 0))
                and (not rpe_available or (rpe_delta is not None and rpe_delta <= 0))
            ):
                module_decision = "progression_intervalles"
                module_reasons.append("ea_up_and_drift_down")
            elif (
                ((ea_reference_delta is not None and ea_reference_delta < 0) or (hrend_delta is not None and hrend_delta > 0))
                and rpe_available
                and rpe_delta is not None
                and rpe_delta >= 1
            ):
                module_decision = "fatigue_intervalles"
                module_reasons.append("ea_down_or_hrend_up_with_rpe")

        global_decision = "historique_insuffisant"
        global_reasons: List[str] = []
        if baseline_count >= MIN_BASELINE_SESSIONS and hr_delta is not None:
            if hr_delta <= -3 and rpe_delta is not None and rpe_delta <= -1 and output_stable:
                global_decision = "amelioration"
                global_reasons.append("hrcorr_down_rpe_down_output_stable")
            elif hr_delta >= 3 and rpe_delta is not None and rpe_delta >= 1:
                global_decision = "fatigue_stress"
                global_reasons.append("hrcorr_up_rpe_up")
            elif hr_delta <= -3 and rpe_delta is not None and rpe_delta >= 1 and (output_down or drift_up_net or abnormal_feeling):
                global_decision = "signal_alarme"
                global_reasons.append("low_hr_high_rpe_pattern")
            else:
                global_decision = "stable"

        if (
            baseline_count >= MIN_BASELINE_SESSIONS
            and hr_delta is not None
            and hr_delta <= -3
            and rpe_delta is not None
            and rpe_delta >= 1
            and ((ea_first_delta is not None and ea_first_delta < 0) or (ea_mean_delta is not None and ea_mean_delta < 0))
        ):
            module_decision = "alerte_intervalles"
            module_reasons.append("low_hr_high_rpe_and_ea_down")

        durability_flag = bool((dec_delta is not None and dec_delta >= 2.0) or (hrend_delta is not None and hrend_delta >= 3.0))
        final_decision = global_decision
        final_reasons = [*global_reasons, *module_reasons]
        if output_ctx.get("normalization") == "speed_fallback_no_grade":
            final_reasons.append("grade_unavailable_speed_fallback")
        if final_decision == "amelioration" and durability_flag:
            final_decision = "amelioration_fragile"
            final_reasons.append("durability_flag")
        elif final_decision == "fatigue_stress" and durability_flag:
            final_decision = "fatigue_confirmee"
            final_reasons.append("durability_flag")
        elif final_decision == "signal_alarme" and durability_flag:
            final_decision = "alerte_renforcee"
            final_reasons.append("durability_flag")

        return {
            "version": SOT_VERSION,
            "module": "intervals",
            "template_key": signature["template_key"],
            "template": {
                "duration_sec": _safe_round(float(np.median([rep["duration_sec"] for rep in rep_windows])), 1),
                "recovery_duration_sec": _safe_round(recovery_duration, 1),
                "rep_count": len(rep_windows),
                "output_band": signature["output_band"],
            },
            "comparable_count": len(matched_rows),
            "comparison_mode": temperature_ctx["comparison_mode"],
            "environment": environment,
            "rep_windows": rep_windows,
            "temperature": {
                "temp": _safe_round(current_temp, 2),
                "tref": _safe_round(temperature_ctx["tref"], 2),
                "beta_hr": _safe_round(temperature_ctx["beta_hr"], 4),
                "beta_drift": _safe_round(temperature_ctx["beta_drift"], 4),
                "hr_mean_raw": _safe_round(hr_mean_raw, 2),
                "hr_corr": _safe_round(temperature_ctx["hr_corr"], 2),
                "drift_raw": _safe_round(dec_int_raw, 3),
                "drift_corr": _safe_round(dec_int, 3),
                "hr_corr_baseline": _safe_round(hr_base, 2),
                "delta_hr_corr": _safe_round(hr_delta, 2),
                "temp_bin_width_c": TEMP_BIN_WIDTH_C,
            },
            "output": {
                "metric": output_ctx["metric"],
                "mean": _safe_round(output_mean, 3),
                "baseline": _safe_round(output_base, 3),
                "delta_pct": _safe_round(output_delta, 2),
                "unit": output_ctx["unit"],
                "stable": output_stable,
                "tolerance_pct": OUTPUT_STABLE_TOLERANCE * 100.0,
                "normalization": output_ctx.get("normalization"),
                "grade_source": output_ctx.get("grade_source"),
                "grade_window_m": _safe_round(_safe_float(output_ctx.get("grade_window_m")), 1),
                "grade_grid_step_m": _safe_round(_safe_float(output_ctx.get("grade_grid_step_m")), 1),
                "grade_coverage_pct": _safe_round(_safe_float(output_ctx.get("grade_coverage_pct")), 3),
                "grade_valid_points": output_ctx.get("grade_valid_points"),
                "grade_quality": output_ctx.get("grade_quality"),
            },
            "ea": {
                "today": _safe_round(ea_mean, 4),
                "baseline": _safe_round(ea_mean_base, 4),
                "delta_pct": _safe_round(ea_mean_delta, 2),
                "first_pair": _safe_round(ea_first, 4),
                "first_pair_baseline": _safe_round(ea_first_base, 4),
                "first_pair_delta_pct": _safe_round(ea_first_delta, 2),
            },
            "decoupling": {
                "metric": "dec_int_pct",
                "raw": _safe_round(dec_int_raw, 3),
                "today": _safe_round(dec_int, 3),
                "baseline": _safe_round(dec_base, 3),
                "delta": _safe_round(dec_delta, 3),
            },
            "hrend_drift": {
                "today": _safe_round(hrend_drift, 2),
                "baseline": _safe_round(hrend_base, 2),
                "delta": _safe_round(hrend_delta, 2),
            },
            "rpe": {
                "today": current_rpe,
                "baseline": _safe_round(rpe_base, 2),
                "delta": _safe_round(rpe_delta, 2),
                "available": current_rpe is not None,
            },
            "decision": {
                "global": global_decision,
                "module": module_decision,
                "final": final_decision,
                "durability_flag": durability_flag,
                "reasons": final_reasons or ["historique_insuffisant"],
            },
            "confidence": self._compute_confidence(
                comparable_count=len(matched_rows),
                baseline_count=baseline_count,
                comparison_mode=temperature_ctx["comparison_mode"],
                has_rpe=current_rpe is not None,
                degraded_output=output_ctx.get("normalization") == "speed_fallback_no_grade",
            ),
        }
