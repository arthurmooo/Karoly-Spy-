import { supabase } from "@/lib/supabase";

export async function getActivities(startDate: string, endDate: string, athleteId: string | null, sport: string | null) {
  let query = supabase
    .from("activities")
    .select("id, athlete_id, session_date, sport_type, work_type, activity_name, duration_sec, distance_m, load_index, avg_hr, athletes(first_name, last_name)")
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .order("session_date", { ascending: true });

  if (athleteId) {
    query = query.eq("athlete_id", athleteId);
  }
  if (sport && sport !== "Tous les sports") {
    query = query.eq("sport_type", sport);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPlannedWorkouts(startDate: string, endDate: string, athleteId: string | null, sport: string | null) {
  let query = supabase
    .from("planned_workouts")
    .select("*, athletes(first_name, last_name)")
    .gte("planned_date", startDate)
    .lte("planned_date", endDate)
    .order("planned_date", { ascending: true });

  if (athleteId) {
    query = query.eq("athlete_id", athleteId);
  }
  if (sport && sport !== "Tous les sports") {
    query = query.eq("sport", sport);
  }

  const { data, error } = await query;
  // Ignore error if table doesn't exist yet
  if (error && error.code === "42P01") {
    return { data: [], isAvailable: false };
  }
  if (error) throw error;
  return { data: data || [], isAvailable: true };
}

export async function getAthletes() {
  const { data, error } = await supabase
    .from("athletes")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("last_name");

  if (error) throw error;
  return data;
}
