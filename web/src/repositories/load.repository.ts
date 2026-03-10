import { supabase } from "@/lib/supabase";

export interface WeeklyMonitoringRow {
  athlete: string;
  week_start: string;
  mls_hebdo: number | null;
  heures_hebdo: number | null;
  nb_seances: number | null;
  mls_moyen_intervalles: number | null;
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
