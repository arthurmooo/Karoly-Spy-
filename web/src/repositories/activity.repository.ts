import { supabase } from "@/lib/supabase";
import type { ActivityFilters, StreamPoint, GarminLap } from "@/types/activity";
import type { ManualBlockOverridePayload } from "@/services/manualIntervals.service";

const PER_PAGE = 25;

export async function getActivities(filters: ActivityFilters = {}) {
  const page = filters.page ?? 0;
  const perPage = filters.per_page ?? PER_PAGE;
  const from = page * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("activities")
    .select(
      `id, athlete_id, session_date, sport_type, work_type, activity_name,
       manual_activity_name, duration_sec, distance_m, load_index, avg_hr, avg_power, rpe,
       interval_pace_mean, interval_power_mean, interval_hr_mean,
       interval_detection_source, decoupling_index,
       athletes!inner(first_name, last_name)`,
      { count: "exact" }
    )
    .order("session_date", { ascending: false })
    .range(from, to);

  if (filters.athlete_id) {
    query = query.eq("athlete_id", filters.athlete_id);
  }
  if (filters.sport_type) {
    query = query.eq("sport_type", filters.sport_type);
  }
  if (filters.date_from) {
    query = query.gte("session_date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("session_date", filters.date_to);
  }
  if (filters.search) {
    query = query.ilike("activity_name", `%${filters.search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

const DETAIL_COLUMNS_BASE = `id, athlete_id, session_date, sport_type, work_type, activity_name, manual_activity_name,
       duration_sec, distance_m, load_index, avg_hr, avg_power, rpe, fit_file_path,
       interval_pace_mean, interval_pace_last, interval_power_mean, interval_power_last,
       interval_hr_mean, interval_hr_last,
       manual_interval_pace_mean, manual_interval_pace_last,
       manual_interval_power_mean, manual_interval_power_last,
       manual_interval_hr_mean, manual_interval_hr_last,
       manual_interval_block_1_power_mean, manual_interval_block_1_power_last,
       manual_interval_block_1_hr_mean, manual_interval_block_1_hr_last,
       manual_interval_block_1_pace_mean, manual_interval_block_1_pace_last,
       manual_interval_block_2_power_mean, manual_interval_block_2_power_last,
       manual_interval_block_2_hr_mean, manual_interval_block_2_hr_last,
       manual_interval_block_2_pace_mean, manual_interval_block_2_pace_last,
       interval_detection_source, decoupling_index,
       durability_index, source_json, segmented_metrics, coach_comment`;

export async function getActivityDetail(id: string) {
  // Try with stream columns; fall back if migration not yet applied
  let { data: activity, error: actErr } = await supabase
    .from("activities")
    .select(`${DETAIL_COLUMNS_BASE}, activity_streams, garmin_laps, athletes(first_name, last_name)`)
    .eq("id", id)
    .single();

  if (actErr?.code === "42703") {
    // Column doesn't exist yet — retry without stream columns
    ({ data: activity, error: actErr } = await supabase
      .from("activities")
      .select(`${DETAIL_COLUMNS_BASE}, athletes(first_name, last_name)`)
      .eq("id", id)
      .single());
  }

  if (actErr) throw actErr;

  const { data: intervals, error: intErr } = await supabase
    .from("activity_intervals")
    .select("*")
    .eq("activity_id", id)
    .order("start_time", { ascending: true });

  if (intErr) throw intErr;

  return { activity, intervals: intervals ?? [] };
}

export async function updateCoachComment(activityId: string, comment: string) {
  const response = await supabase.functions.invoke("update-coach-comment", {
    body: { activity_id: activityId, comment },
  });
  if (response.error) throw response.error;
  return response.data as { success: boolean; nolio_synced: boolean };
}

export async function fetchActivityStreams(activityId: string) {
  const { data, error } = await supabase.functions.invoke("get-activity-streams", {
    body: { activity_id: activityId },
  });
  if (error) throw error;
  return data as { streams: StreamPoint[] | null; laps: GarminLap[] | null };
}

export async function updateManualIntervalOverrides(
  activityId: string,
  payload: ManualBlockOverridePayload
) {
  const { data, error } = await supabase
    .from("activities")
    .update(payload)
    .eq("id", activityId)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentActivities(limit = 10) {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, athlete_id, session_date, sport_type, work_type, activity_name,
       manual_activity_name, duration_sec, distance_m, load_index, avg_hr,
       athletes(first_name, last_name)`
    )
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
