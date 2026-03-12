export interface StreamPoint {
  t: number;      // elapsed seconds
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
  activity_name: string;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  avg_hr: number | null;
  avg_power: number | null;
  rpe: number | null;
  coach_comment?: string | null;
  athlete_comment?: string | null;
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
  interval_detection_source: string | null;
  decoupling_index: number | null;
  durability_index: number | null;
  manual_activity_name?: string | null;
  fit_file_path?: string | null;
  source_json?: ActivitySourceJson | null;
  segmented_metrics?: SegmentedMetrics | null;
  activity_streams?: StreamPoint[] | null;
  garmin_laps?: GarminLap[] | null;
  athletes?: {
    first_name: string;
    last_name: string;
  } | null;
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

export interface ActivityFilters {
  athlete_id?: string;
  sport_type?: string;
  work_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
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

export interface SegmentedMetrics {
  manual?: unknown;
  splits_2?: Record<string, SegmentPhaseMetrics>;
  splits_4?: Record<string, SegmentPhaseMetrics>;
  drift_percent?: number | null;
  interval_blocks?: IntervalBlock[];
  segmentation_type?: string | null;
  interval_pahr_last?: number | null;
  interval_pahr_mean?: number | null;
  per_index?: number | null;
  rpe_delta?: number | null;
}
