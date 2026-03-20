import { supabase } from "@/lib/supabase";
import type { Athlete } from "@/types/athlete";

const ATHLETE_COLUMNS = "id, first_name, last_name, nolio_id, email, is_active, start_date, athlete_group_id";

export async function getAthletes(): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_COLUMNS)
    .eq("is_active", true)
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Athlete[];
}

export async function getAllAthletes(): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_COLUMNS)
    .order("last_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Athlete[];
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_COLUMNS)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Athlete | null;
}

export async function inviteAthlete(payload: {
  email: string;
  first_name: string;
  last_name: string;
  athlete_group_id?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("invite-athlete", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function manageAthlete(payload: {
  athlete_id: string;
  action: string;
  group_id?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("manage-athlete", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
