export type AcwrMetricKind = "external" | "internal" | "global";

export type AcwrStatus = "low" | "ok" | "warning" | "alert" | "insufficient_data";

export type AcwrDataSource = "phase1_proxy" | "phase2_components";

export interface AcwrActivityInput {
  athlete_id: string;
  athlete_name: string;
  session_date: string;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  rpe: number | null;
}

export interface ActivityLoadRow {
  athlete_id: string;
  athlete: string;
  session_date: string;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  rpe: number | null;
  external_duration_min: number | null;
  external_distance_km: number | null;
  external_intensity_ratio_avg: number | null;
  internal_srpe_load: number | null;
  internal_time_lt1_sec: number | null;
  internal_time_between_lt1_lt2_sec: number | null;
  internal_time_gt_lt2_sec: number | null;
  global_mls: number | null;
  data_source: AcwrDataSource;
}

export interface AcwrMetricSnapshot {
  kind: AcwrMetricKind;
  label: string;
  acute_7d: number | null;
  chronic_28d_weekly_equiv: number | null;
  ratio: number | null;
  status: AcwrStatus;
  coverage_pct: number | null;
  valid_sessions_28d: number;
  total_sessions_28d: number;
  note: string;
  data_source: AcwrDataSource;
}

export interface AcwrSnapshotRow {
  athlete_id: string;
  athlete: string;
  latest_session_date: string | null;
  external: AcwrMetricSnapshot;
  internal: AcwrMetricSnapshot;
  global: AcwrMetricSnapshot;
}

export interface AthleteAcwrDetail {
  athlete_id: string;
  athlete: string;
  latest_session_date: string | null;
  external: AcwrMetricSnapshot;
  internal: AcwrMetricSnapshot;
  global: AcwrMetricSnapshot;
}

export interface AcwrDashboardSummary {
  alertCount: number;
  warningCount: number;
  insufficientCount: number;
}
