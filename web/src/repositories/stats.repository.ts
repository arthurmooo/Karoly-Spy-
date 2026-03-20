import { supabase } from "@/lib/supabase";

export interface StatsActivityRow {
  id: string;
  session_date: string;
  sport_type: string | null;
  distance_m: number | null;
  moving_time_sec: number | null;
  duration_sec: number | null;
  load_index: number | null;
  rpe: number | null;
  decoupling_index: number | null;
  durability_index: number | null;
  avg_hr: number | null;
  work_type: string | null;
  activity_name: string | null;
  segmented_metrics: Record<string, unknown> | null;
  hr_zones_sec: Record<string, number> | null;
}

interface GetStatsActivitiesParams {
  athleteId: string;
  from: Date;
  to: Date;
}

const STATS_ACTIVITY_BASE_COLUMNS = [
  "id",
  "session_date",
  "sport_type",
  "distance_m",
  "moving_time_sec",
  "duration_sec",
  "load_index",
  "rpe",
  "decoupling_index",
  "durability_index",
  "avg_hr",
  "work_type",
  "activity_name",
  "segmented_metrics",
];

const STATS_ACTIVITY_COLUMNS = [...STATS_ACTIVITY_BASE_COLUMNS, "hr_zones_sec"].join(", ");
const STATS_ACTIVITY_FALLBACK_COLUMNS = STATS_ACTIVITY_BASE_COLUMNS.join(", ");

function isMissingHrZonesColumnError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42703" && error.message?.includes("activities.hr_zones_sec") === true;
}

export async function getStatsActivities({
  athleteId,
  from,
  to,
}: GetStatsActivitiesParams): Promise<StatsActivityRow[]> {
  const buildQuery = (columns: string) =>
    supabase
      .from("activities")
      .select(columns)
      .eq("athlete_id", athleteId)
      .gte("session_date", from.toISOString())
      .lte("session_date", to.toISOString())
      .order("session_date", { ascending: true });

  let { data, error } = await buildQuery(STATS_ACTIVITY_COLUMNS);

  if (isMissingHrZonesColumnError(error)) {
    ({ data, error } = await buildQuery(STATS_ACTIVITY_FALLBACK_COLUMNS));
  }

  if (error) throw error;

  return ((data ?? []) as Array<Partial<StatsActivityRow>>).map((row) => ({
    ...row,
    hr_zones_sec: row.hr_zones_sec ?? null,
  })) as StatsActivityRow[];
}
