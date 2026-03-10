export interface DailyReadiness {
  athlete_id: string;
  date: string;
  rmssd: number | null;
  resting_hr: number | null;
  sleep_duration: number | null;
  sleep_score: number | null;
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
}
