import { supabase } from "@/lib/supabase";
import type { HealthRadarRow, DailyReadiness } from "@/types/readiness";

export async function getHealthRadar(): Promise<HealthRadarRow[]> {
  const { data, error } = await supabase
    .from("view_health_radar")
    .select("*");

  if (error) throw error;
  return (data ?? []) as HealthRadarRow[];
}

export async function getReadinessSeries(
  athleteId: string,
  days = 30
): Promise<DailyReadiness[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("daily_readiness")
    .select("*")
    .eq("athlete_id", athleteId)
    .gte("date", since.toISOString().split("T")[0])
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
  }>
) {
  const { error } = await supabase
    .from("daily_readiness")
    .upsert(rows, { onConflict: "athlete_id,date" });

  if (error) throw error;
}
