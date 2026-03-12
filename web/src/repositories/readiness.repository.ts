import { supabase } from "@/lib/supabase";
import type { HealthRadarRow, DailyReadiness } from "@/types/readiness";

const READINESS_BASELINE_WINDOW = 30;
const UPSERT_CHUNK_SIZE = 200;

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

async function recomputeReadinessBaselines(athleteId: string) {
  const { data, error } = await supabase
    .from("daily_readiness")
    .select("athlete_id, date, rmssd, resting_hr")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<Pick<DailyReadiness, "athlete_id" | "date" | "rmssd" | "resting_hr">>;
  if (rows.length === 0) return;

  const updates = rows.map((row, index) => {
    const window = rows.slice(Math.max(0, index - (READINESS_BASELINE_WINDOW - 1)), index + 1);
    const rmssdValues = window
      .map((entry) => entry.rmssd)
      .filter((value): value is number => value !== null);
    const restingHrValues = window
      .map((entry) => entry.resting_hr)
      .filter((value): value is number => value !== null);

    return {
      athlete_id: row.athlete_id,
      date: row.date,
      rmssd_30d_avg: mean(rmssdValues),
      resting_hr_30d_avg: mean(restingHrValues),
    };
  });

  for (let offset = 0; offset < updates.length; offset += UPSERT_CHUNK_SIZE) {
    const chunk = updates.slice(offset, offset + UPSERT_CHUNK_SIZE);
    const { error: upsertError } = await supabase
      .from("daily_readiness")
      .upsert(chunk, { onConflict: "athlete_id,date" });

    if (upsertError) throw upsertError;
  }
}

export async function getHealthRadar(): Promise<HealthRadarRow[]> {
  const todayIso = getTodayIsoDate();
  const { data, error } = await supabase
    .from("view_health_radar")
    .select("*")
    .lte("date", todayIso);

  if (error) throw error;
  return (data ?? []) as HealthRadarRow[];
}

export async function getReadinessSeries(
  athleteId: string,
  days = 30
): Promise<DailyReadiness[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const todayIso = getTodayIsoDate();

  const { data, error } = await supabase
    .from("daily_readiness")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", since.toISOString().split("T")[0])
    .lte("date", todayIso)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyReadiness[];
}

export async function insertHrvBatch(
  rows: Array<{
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
  }>
) {
  const { error } = await supabase
    .from("daily_readiness")
    .upsert(rows, { onConflict: "athlete_id,date" });

  if (error) throw error;

  const athleteIds = [...new Set(rows.map((row) => row.athlete_id))];
  for (const athleteId of athleteIds) {
    await recomputeReadinessBaselines(athleteId);
  }
}
