export interface DailyReadiness {
  athlete_id: string;
  date: string;
  rmssd: number | null;
  resting_hr: number | null;
  sleep_duration: number | null;
  sleep_score: number | null;
  sleep_quality: number | null;
  mental_energy: number | null;
  fatigue: number | null;
  lifestyle: number | null;
  muscle_soreness: number | null;
  physical_condition: number | null;
  training_performance: number | null;
  training_rpe: number | null;
  recovery_points: number | null;
  sickness: string | null;
  alcohol: string | null;
  rmssd_30d_avg: number | null;
  resting_hr_30d_avg: number | null;
}

export interface HealthRadarRow {
  athlete_id: string;
  athlete: string;
  date: string;
  rmssd_matinal: number | null;
  fc_repos: number | null;
  tendance_rmssd_pct: number | null;
  poids: number | null;
  ln_rmssd_7d_avg: number | null;
  swc_mean_28d: number | null;
  swc_low_28d: number | null;
  swc_high_28d: number | null;
  swc_status:
    | "within_swc"
    | "below_swc"
    | "above_swc"
    | "insufficient_data"
    | null;
  swc_recommendation: "low/rest" | "normal" | null;
  sleep_quality: number | null;
  mental_energy: number | null;
  fatigue: number | null;
  lifestyle: number | null;
  sickness: string | null;
  alcohol: string | null;
}
