export type WorkTypeValue = "endurance" | "intervals" | "competition";

export type SectionCommentKey =
  | "form_analysis"
  | "zone_distribution"
  | "decoupling"
  | "intervals_chart"
  | "intervals_detail"
  | "target_vs_actual"
  | "segment_analysis"
  | "phase_comparison";

export interface StreamPoint {
  t: number;      // active seconds on the chart axis
  elapsed_t?: number; // elapsed seconds since activity start
  dist_m?: number; // cumulative active distance in meters
  hr?: number;    // bpm
  spd?: number;   // m/s
  pwr?: number;   // watts
  cad?: number;
  alt?: number;   // meters
}

export interface GarminLap {
  lap_n: number;
  start_sec: number;
  duration_sec: number;
  distance_m: number;
  avg_hr?: number;
  avg_speed?: number;  // m/s
  avg_power?: number;
  avg_cadence?: number;
  max_hr?: number;
  max_speed?: number;
}

export interface Activity {
  id: string;
  athlete_id: string;
  athlete_name?: string;
  session_date: string;
  sport_type: string;
  work_type: string | null;
  manual_work_type?: WorkTypeValue | null;
  detected_work_type?: WorkTypeValue | null;
  analysis_dirty?: boolean;
  activity_name: string;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  avg_hr: number | null;
  avg_power: number | null;
  rpe: number | null;
  coach_comment?: string | null;
  section_comments?: Record<string, string> | null;
  athlete_comment?: string | null;
  athlete_feedback_rating?: number | null;  // 1-5
  athlete_feedback_text?: string | null;
  interval_pace_mean: number | null;
  interval_pace_last: number | null;
  interval_power_mean: number | null;
  interval_power_last: number | null;
  interval_hr_mean: number | null;
  interval_hr_last: number | null;
  manual_interval_power_mean?: number | null;
  manual_interval_power_last?: number | null;
  manual_interval_hr_mean?: number | null;
  manual_interval_hr_last?: number | null;
  manual_interval_pace_mean?: number | null;
  manual_interval_pace_last?: number | null;
  manual_interval_block_1_power_mean?: number | null;
  manual_interval_block_1_power_last?: number | null;
  manual_interval_block_1_hr_mean?: number | null;
  manual_interval_block_1_hr_last?: number | null;
  manual_interval_block_1_pace_mean?: number | null;
  manual_interval_block_1_pace_last?: number | null;
  manual_interval_block_2_power_mean?: number | null;
  manual_interval_block_2_power_last?: number | null;
  manual_interval_block_2_hr_mean?: number | null;
  manual_interval_block_2_hr_last?: number | null;
  manual_interval_block_2_pace_mean?: number | null;
  manual_interval_block_2_pace_last?: number | null;
  manual_interval_block_1_count?: number | null;
  manual_interval_block_1_duration_sec?: number | null;
  manual_interval_block_2_count?: number | null;
  manual_interval_block_2_duration_sec?: number | null;
  manual_interval_segments?: ManualIntervalSegmentsBlock[] | null;
  interval_detection_source: string | null;
  decoupling_index: number | null;
  durability_index: number | null;
  temp_avg?: number | null;
  elevation_gain?: number | null;
  manual_activity_name?: string | null;
  fit_file_path?: string | null;
  source_json?: ActivitySourceJson | null;
  segmented_metrics?: SegmentedMetrics | null;
  form_analysis?: FormAnalysis | null;
  activity_streams?: StreamPoint[] | null;
  garmin_laps?: GarminLap[] | null;
  athletes?: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface BlockGroupedIntervals {
  blockIndex: number;
  label: string;
  intervals: ActivityInterval[];
}

export interface ActivityInterval {
  id: string;
  activity_id: string;
  type: string;
  start_time: number;
  end_time: number;
  duration: number;
  avg_speed: number | null;
  avg_power: number | null;
  avg_hr: number | null;
  avg_cadence: number | null;
  detection_source: string | null;
  respect_score: number | null;
}

export interface ManualIntervalSegment {
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  distance_m: number;
  avg_speed: number | null;
  avg_power: number | null;
  avg_hr: number | null;
}

export interface ManualIntervalSegmentsBlock {
  block_index: number;
  segments: ManualIntervalSegment[];
}

export interface ActivityComparisonCandidate {
  id: string;
  athlete_id: string;
  session_date: string;
  sport_type: string;
  work_type?: string | null;
  activity_name: string;
  manual_activity_name?: string | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_power: number | null;
  decoupling_index: number | null;
}

export interface FormAnalysisComparableActivity {
  id: string;
  athlete_id: string;
  session_date: string;
  sport_type: string;
  activity_name: string;
  manual_activity_name?: string | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_power: number | null;
  rpe: number | null;
  temp_avg?: number | null;
  form_analysis?: FormAnalysis | null;
}

export interface ActivityFilters {
  athlete_id?: string;
  sport_type?: string;
  work_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  duration_min?: number; // seconds
  duration_max?: number; // seconds
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export interface ActivityComparisonLibraryFilters {
  work_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  duration_min?: number;
  duration_max?: number;
}

export interface ActivitySourceJson {
  rpe?: number | null;
  feeling?: number | null;
  name?: string | null;
  sport?: string | null;
  distance?: number | null;
  duration?: number | null;
  description?: string | null;
  comment?: string | null;
  file_url?: string | null;
  planned_name?: string | null;
  planned_description?: string | null;
}

export interface SegmentPhaseMetrics {
  hr?: number | null;
  power?: number | null;
  ratio?: number | null;
  speed?: number | null;
  torque?: number | null;
}

export interface IntervalBlock {
  block_index: number;
  count: number | null;
  interval_hr_last: number | null;
  interval_hr_mean: number | null;
  interval_pace_last: number | null;
  interval_pace_mean: number | null;
  interval_pahr_last: number | null;
  interval_pahr_mean: number | null;
  interval_power_last: number | null;
  interval_power_mean: number | null;
  interval_respect_score_mean: number | null;
  representative_distance_m: number | null;
  representative_duration_sec: number | null;
  total_duration_sec: number | null;
}

export interface PlannedIntervalBlock {
  block_index: number;
  count: number | null;
  representative_duration_sec: number | null;
  representative_distance_m: number | null;
  target_type: string | null;
  target_min: number | null;
  target_max: number | null;
  planned_source: string | null;
}

export interface SegmentedMetrics {
  manual?: unknown;
  splits_2?: Record<string, SegmentPhaseMetrics>;
  splits_4?: Record<string, SegmentPhaseMetrics>;
  drift_percent?: number | null;
  interval_blocks?: IntervalBlock[];
  planned_interval_blocks?: PlannedIntervalBlock[];
  segmentation_type?: string | null;
  interval_pahr_last?: number | null;
  interval_pahr_mean?: number | null;
  per_index?: number | null;
  rpe_delta?: number | null;
}

export type ComparisonAlertKind = "progression" | "cout" | "regression" | "none";
export type ComparisonTrend = "positive" | "negative" | "neutral";

export interface ComparisonAlert {
  kind: ComparisonAlertKind;
  title: string;
  message: string;
}

export interface ComparisonDeltaRow {
  key: "volume" | "duration" | "main_metric" | "hr" | "decoupling" | "temperature" | "elevation";
  label: string;
  currentValue: string;
  referenceValue: string;
  deltaValue: string;
  trend: ComparisonTrend;
}

export interface ComparisonSummary {
  metricLabel: string;
  metricUnitLabel: string;
  rows: ComparisonDeltaRow[];
  alert: ComparisonAlert;
  isSegmentComparison: boolean;
  currentRangeLabel: string;
  referenceRangeLabel: string;
}

export interface ComparisonRangeSelection {
  startKm: number;
  endKm: number;
}

export type FormAnalysisModule = "continuous_tempo" | "intervals";
export type ComparisonMode = "beta_regression" | "same_temp_bin";
export type FormGlobalDecision =
  | "amelioration"
  | "fatigue_stress"
  | "signal_alarme"
  | "stable"
  | "historique_insuffisant"
  | "amelioration_fragile"
  | "fatigue_confirmee"
  | "alerte_renforcee";

export type FormModuleDecision =
  | "progression_tempo"
  | "degradation_tendance"
  | "fatigue_stress"
  | "progression_intervalles"
  | "fatigue_intervalles"
  | "alerte_intervalles"
  | "historique_insuffisant";

export interface StableSegment {
  window_label?: string | null;
  start_sec?: number | null;
  end_sec?: number | null;
  selected_points?: number | null;
}

export interface RepWindow {
  rep_index: number;
  start_sec?: number | null;
  end_sec?: number | null;
  duration_sec?: number | null;
  hr_raw?: number | null;
  hr_corr?: number | null;
  output?: number | null;
  ea?: number | null;
}

export interface TemperatureCorrection {
  temp?: number | null;
  tref?: number | null;
  beta_hr?: number | null;
  beta_drift?: number | null;
  hr_mean_raw?: number | null;
  hr_corr?: number | null;
  hr_corr_baseline?: number | null;
  delta_hr_corr?: number | null;
  drift_raw?: number | null;
  drift_corr?: number | null;
  temp_bin_width_c?: number | null;
}

export interface OutputSnapshot {
  metric?: string | null;
  mean?: number | null;
  baseline?: number | null;
  delta_pct?: number | null;
  unit?: string | null;
  stable?: boolean | null;
  tolerance_pct?: number | null;
  normalization?: string | null;
  grade_source?: string | null;
  grade_window_m?: number | null;
  grade_grid_step_m?: number | null;
  grade_coverage_pct?: number | null;
  grade_valid_points?: number | null;
  grade_quality?: string | null;
}

export interface EaSnapshot {
  today?: number | null;
  baseline?: number | null;
  delta_pct?: number | null;
  first_half?: number | null;
  second_half?: number | null;
  first_pair?: number | null;
  first_pair_baseline?: number | null;
  first_pair_delta_pct?: number | null;
}

export interface DecouplingSnapshot {
  metric?: string | null;
  raw?: number | null;
  today?: number | null;
  baseline?: number | null;
  delta?: number | null;
}

export interface HrEndDriftSnapshot {
  today?: number | null;
  baseline?: number | null;
  delta?: number | null;
}

export interface RpeSnapshot {
  today?: number | null;
  baseline?: number | null;
  delta?: number | null;
  available?: boolean | null;
}

export interface FormDecision {
  global?: FormGlobalDecision | null;
  module?: FormModuleDecision | null;
  final?: FormGlobalDecision | null;
  durability_flag?: boolean | null;
  reasons?: string[] | null;
}

export interface FormAnalysis {
  version: string;
  module: FormAnalysisModule;
  template_key?: string | null;
  template?: {
    duration_sec?: number | null;
    recovery_duration_sec?: number | null;
    rep_count?: number | null;
    output_band?: number | null;
  } | null;
  comparable_count?: number | null;
  comparison_mode?: ComparisonMode | null;
  environment?: {
    location?: string | null;
    terrain?: string | null;
  } | null;
  stable_segment?: StableSegment | null;
  rep_windows?: RepWindow[] | null;
  temperature?: TemperatureCorrection | null;
  output?: OutputSnapshot | null;
  ea?: EaSnapshot | null;
  decoupling?: DecouplingSnapshot | null;
  hrend_drift?: HrEndDriftSnapshot | null;
  rpe?: RpeSnapshot | null;
  decision?: FormDecision | null;
  confidence?: number | null;
}
