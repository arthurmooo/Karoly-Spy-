import { supabase } from "@/lib/supabase";
import type { AthleteGroup } from "@/types/athlete";

export async function getAthleteGroups(): Promise<AthleteGroup[]> {
  const { data, error } = await supabase
    .from("athlete_groups")
    .select("id, name, color, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AthleteGroup[];
}

export async function manageAthleteGroup(payload: {
  action: string;
  [key: string]: unknown;
}) {
  const { data, error } = await supabase.functions.invoke("manage-athlete-group", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
