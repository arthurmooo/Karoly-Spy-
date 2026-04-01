import { supabase } from "@/lib/supabase";

export async function getActivities(startDate: string, endDate: string, athleteId: string | null, sport: string | null) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("activities")
      .select("id, athlete_id, session_date, sport_type, source_sport, work_type, activity_name, duration_sec, distance_m, load_index, avg_hr, athletes(first_name, last_name)")
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .order("session_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (athleteId) query = query.eq("athlete_id", athleteId);
    if (sport && sport !== "Tous les sports") query = query.eq("sport_type", sport);

    const { data, error } = await query;
    if (error) throw error;
    allData.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

export async function getPlannedWorkouts(startDate: string, endDate: string, athleteId: string | null, sport: string | null) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("planned_workouts")
      .select("*, athletes(first_name, last_name)")
      .gte("planned_date", startDate)
      .lte("planned_date", endDate)
      .order("planned_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (athleteId) query = query.eq("athlete_id", athleteId);
    if (sport && sport !== "Tous les sports") query = query.eq("sport", sport);

    const { data, error } = await query;
    // Ignore error if table doesn't exist yet
    if (error && error.code === "42P01") {
      return { data: [], isAvailable: false };
    }
    if (error) throw error;
    allData.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: allData, isAvailable: true };
}

export interface PlannedWorkout {
  id: string;
  sport: string | null;
  name: string | null;
  planned_date: string;
  athlete_id: string;
}

export async function getNextPlannedWorkout(athleteId: string): Promise<PlannedWorkout | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("id, sport, name, planned_date, athlete_id")
    .eq("athlete_id", athleteId)
    .gte("planned_date", today)
    .order("planned_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && error.code === "42P01") return null;
  if (error) throw error;
  return data as PlannedWorkout | null;
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
