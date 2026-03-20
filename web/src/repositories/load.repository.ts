import { supabase } from "@/lib/supabase";
import type { AcwrActivityInput, ActivityLoadRow } from "@/types/acwr";

export interface WeeklyMonitoringRow {
  athlete: string;
  week_start: string;
  mls_hebdo: number | null;
  heures_hebdo: number | null;
  nb_seances: number | null;
  mls_moyen_intervalles: number | null;
}

export interface DailyLoadHistoryRow {
  id: string;
  session_date: string;
  load_index: number | null;
  duration_sec: number | null;
}

function toUtcDayBoundary(date: string, boundary: "start" | "end"): string {
  const [yearPart, monthPart, dayPart] = date.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return date;
  }

  const value =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return value.toISOString();
}

function toLocalIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getWeeklyMonitoring(
  weeks = 12
): Promise<WeeklyMonitoringRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from("view_weekly_monitoring")
    .select("*")
    .gte("week_start", since.toISOString().split("T")[0])
    .order("week_start", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WeeklyMonitoringRow[];
}

type AcwrMonitoringViewRow = {
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
};

type ActivityLoadFallbackRow = {
  athlete_id: string;
  session_date: string;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  rpe: number | null;
  athletes:
    | {
        first_name: string;
        last_name: string;
      }
    | Array<{
        first_name: string;
        last_name: string;
      }>
    | null;
};

const ACWR_LOOKBACK_DAYS = 42;

function getSinceIsoDate(days: number): string {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return since.toISOString().slice(0, 10);
}

function isAcwrViewUnavailable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01"
    || error.code === "42703"
    || error.message?.toLowerCase().includes("view_acwr_monitoring") === true
  );
}

function mapAcwrViewRows(rows: AcwrMonitoringViewRow[]): ActivityLoadRow[] {
  return rows.map((row) => ({
    athlete_id: row.athlete_id,
    athlete: row.athlete,
    session_date: row.session_date,
    duration_sec: row.duration_sec,
    moving_time_sec: row.moving_time_sec,
    distance_m: row.distance_m,
    load_index: row.load_index,
    rpe: row.rpe,
    external_duration_min: row.external_duration_min,
    external_distance_km: row.external_distance_km,
    external_intensity_ratio_avg: row.external_intensity_ratio_avg,
    internal_srpe_load: row.internal_srpe_load,
    internal_time_lt1_sec: row.internal_time_lt1_sec,
    internal_time_between_lt1_lt2_sec: row.internal_time_between_lt1_lt2_sec,
    internal_time_gt_lt2_sec: row.internal_time_gt_lt2_sec,
    global_mls: row.global_mls,
    data_source: "phase2_components",
  }));
}

function mapActivityRows(rows: ActivityLoadFallbackRow[]): ActivityLoadRow[] {
  return rows.map((row) => {
    const athlete = Array.isArray(row.athletes)
      ? (row.athletes[0] ?? null)
      : row.athletes;

    return {
      athlete_id: row.athlete_id,
      athlete: athlete
        ? `${athlete.first_name} ${athlete.last_name}`
        : "Inconnu",
      session_date: row.session_date,
      duration_sec: row.duration_sec,
      moving_time_sec: row.moving_time_sec,
      distance_m: row.distance_m,
      load_index: row.load_index,
      rpe: row.rpe,
      external_duration_min: null,
      external_distance_km: null,
      external_intensity_ratio_avg: null,
      internal_srpe_load: null,
      internal_time_lt1_sec: null,
      internal_time_between_lt1_lt2_sec: null,
      internal_time_gt_lt2_sec: null,
      global_mls: null,
      data_source: "phase1_proxy",
    };
  });
}

export async function getAcwrMonitoringRows(
  athleteId?: string
): Promise<ActivityLoadRow[]> {
  const sinceIso = getSinceIsoDate(ACWR_LOOKBACK_DAYS);

  let acwrQuery = supabase
    .from("view_acwr_monitoring")
    .select(
      "athlete_id, athlete, session_date, duration_sec, moving_time_sec, distance_m, load_index, rpe, external_duration_min, external_distance_km, external_intensity_ratio_avg, internal_srpe_load, internal_time_lt1_sec, internal_time_between_lt1_lt2_sec, internal_time_gt_lt2_sec, global_mls"
    )
    .gte("session_date", sinceIso)
    .order("session_date", { ascending: false });

  if (athleteId) {
    acwrQuery = acwrQuery.eq("athlete_id", athleteId);
  }

  const { data: acwrData, error: acwrError } = await acwrQuery;

  if (!acwrError) {
    return mapAcwrViewRows((acwrData ?? []) as AcwrMonitoringViewRow[]);
  }

  if (!isAcwrViewUnavailable(acwrError)) {
    throw acwrError;
  }

  let fallbackQuery = supabase
    .from("activities")
    .select(
      "athlete_id, session_date, duration_sec, moving_time_sec, distance_m, load_index, rpe, athletes!inner(first_name, last_name)"
    )
    .gte("session_date", sinceIso)
    .order("session_date", { ascending: false });

  if (athleteId) {
    fallbackQuery = fallbackQuery.eq("athlete_id", athleteId);
  }

  const { data: fallbackData, error: fallbackError } = await fallbackQuery;
  if (fallbackError) throw fallbackError;

  return mapActivityRows((fallbackData ?? []) as ActivityLoadFallbackRow[]);
}

export async function getAthleteDailyLoadHistory(
  athleteId: string,
  anchorDate: string
): Promise<DailyLoadHistoryRow[]> {
  const since = new Date(`${anchorDate}T12:00:00`);
  since.setDate(since.getDate() - 83);

  const { data, error } = await supabase
    .from("activities")
    .select("id, session_date, load_index, duration_sec")
    .eq("athlete_id", athleteId)
    .gte("session_date", toUtcDayBoundary(toLocalIsoDate(since), "start"))
    .lte("session_date", toUtcDayBoundary(anchorDate, "end"))
    .order("session_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyLoadHistoryRow[];
}

const ACWR_ACTIVITY_COLUMNS = `
  athlete_id,
  session_date,
  duration_sec,
  moving_time_sec,
  distance_m,
  load_index,
  rpe,
  athletes!inner(first_name, last_name)
`;

function getAcwrSinceIso(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function mapAcwrRows(rows: Array<Record<string, unknown>>): AcwrActivityInput[] {
  return rows.map((row) => {
    const athletes = row.athletes as { first_name: string; last_name: string } | null;
    return {
      athlete_id: row.athlete_id as string,
      athlete_name: athletes
        ? `${athletes.first_name} ${athletes.last_name}`
        : "Athlete inconnu",
      session_date: row.session_date as string,
      duration_sec: row.duration_sec as number | null,
      moving_time_sec: row.moving_time_sec as number | null,
      distance_m: row.distance_m as number | null,
      load_index: row.load_index as number | null,
      rpe: row.rpe as number | null,
    };
  });
}

export async function getAcwrActivities(days = 28): Promise<AcwrActivityInput[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACWR_ACTIVITY_COLUMNS)
    .gte("session_date", getAcwrSinceIso(days))
    .order("session_date", { ascending: false });

  if (error) throw error;
  return mapAcwrRows((data ?? []) as Array<Record<string, unknown>>);
}

export async function getAthleteAcwrActivities(
  athleteId: string,
  days = 28
): Promise<AcwrActivityInput[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACWR_ACTIVITY_COLUMNS)
    .eq("athlete_id", athleteId)
    .gte("session_date", getAcwrSinceIso(days))
    .order("session_date", { ascending: false });

  if (error) throw error;
  return mapAcwrRows((data ?? []) as Array<Record<string, unknown>>);
}
