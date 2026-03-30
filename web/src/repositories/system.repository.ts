import { supabase } from "@/lib/supabase";

export interface SystemMonitoringRow {
  key: string;
  value_gb: number | null;
  limit_gb: number | null;
  checked_at: string | null;
  details: Record<string, unknown> | null;
}

export async function getStorageUsage(): Promise<SystemMonitoringRow | null> {
  const { data, error } = await supabase
    .from("system_monitoring")
    .select("*")
    .eq("key", "storage_raw_fits")
    .single();

  if (error) {
    // Table may not exist yet — don't throw
    console.warn("system_monitoring query failed:", error.message);
    return null;
  }

  return data as SystemMonitoringRow;
}
