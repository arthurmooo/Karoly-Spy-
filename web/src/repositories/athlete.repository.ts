import { supabase } from "@/lib/supabase";
import type { Athlete } from "@/types/athlete";

export async function getAthletes(): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, nolio_id, email, is_active, start_date")
    .eq("is_active", true)
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Athlete[];
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, nolio_id, email, is_active, start_date")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Athlete | null;
}
