import { supabase } from "@/lib/supabase";
import { normalizeSportKey } from "@/services/activity.service";
import type {
  Activity,
  ActivityInterval,
  ActivityComparisonCandidate,
  ActivityFilters,
  GarminLap,
  StreamPoint,
  WorkTypeValue,
} from "@/types/activity";
import type { ManualIntervalsUpdatePayload } from "@/services/manualIntervals.service";

const PER_PAGE = 25;

const SPORT_FILTER_ALIASES: Record<string, string[]> = {
  CAP: ["CAP", "Run", "run", "Course", "Course à pied", "course à pied"],
  VELO: ["VELO", "VÉLO", "Bike", "bike", "Cycling", "cycling", "VTT", "vtt"],
  NAT: ["NAT", "Swim", "swim", "Natation", "natation"],
  SKI: ["SKI", "Ski", "ski", "Ski de fond", "ski de fond"],
  TRI: ["TRI", "Tri", "tri", "Triathlon", "triathlon"],
  MUSC: ["MUSC", "Strength", "strength", "Musculation", "musculation"],
};

function getSportFilterValues(sportType: string): string[] {
  return SPORT_FILTER_ALIASES[sportType] ?? [sportType];
}

function toUtcDayBoundary(date: string, boundary: "start" | "end"): string {
  const [yearPart, monthPart, dayPart] = date.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return date;
  }

  const value =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return value.toISOString();
}

export async function getActivities(filters: ActivityFilters = {}) {
  const page = filters.page ?? 0;
  const perPage = filters.per_page ?? PER_PAGE;
  const from = page * perPage;
  const to = from + perPage - 1;
  const sortBy = filters.sort_by ?? "session_date";
  const ascending = filters.sort_dir === "asc";

  let query = supabase
    .from("activities")
    .select(
      `id, athlete_id, session_date, sport_type, work_type, activity_name,
       manual_activity_name, duration_sec, moving_time_sec, distance_m, load_index, avg_hr, avg_power, rpe,
       interval_pace_mean, interval_power_mean, interval_hr_mean,
       interval_detection_source, decoupling_index,
       athletes!inner(first_name, last_name)`,
      { count: "exact" }
    );

  if (filters.athlete_id) {
    query = query.eq("athlete_id", filters.athlete_id);
  }
  if (filters.sport_type) {
    query = query.in("sport_type", getSportFilterValues(filters.sport_type));
  }
  if (filters.work_type) {
    query = query.eq("work_type", filters.work_type);
  }
  if (filters.date_from) {
    query = query.gte("session_date", toUtcDayBoundary(filters.date_from, "start"));
  }
  if (filters.date_to) {
    query = query.lte("session_date", toUtcDayBoundary(filters.date_to, "end"));
  }
  if (filters.search) {
    const term = filters.search;
    // Find athletes whose name matches the search term
    const { data: matchedAthletes } = await supabase
      .from("athletes")
      .select("id")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
    const ids = matchedAthletes?.map((a) => a.id) ?? [];
    if (ids.length > 0) {
      query = query.or(
        `activity_name.ilike.%${term}%,athlete_id.in.(${ids.join(",")})`
      );
    } else {
      query = query.ilike("activity_name", `%${term}%`);
    }
  }
  if (filters.duration_min != null) {
    query = query.gte("duration_sec", filters.duration_min);
  }
  if (filters.duration_max != null) {
    query = query.lte("duration_sec", filters.duration_max);
  }

  if (sortBy === "athlete_name") {
    query = query
      .order("last_name", { ascending, referencedTable: "athletes" })
      .order("first_name", { ascending, referencedTable: "athletes" });
  } else {
    query = query.order(sortBy, { ascending });
  }

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

const DETAIL_COLUMNS_CORE = `id, athlete_id, session_date, sport_type, work_type, activity_name, manual_activity_name,
       duration_sec, moving_time_sec, distance_m, load_index, avg_hr, avg_power, rpe, fit_file_path,
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
       manual_interval_block_1_count, manual_interval_block_1_duration_sec,
       manual_interval_block_2_count, manual_interval_block_2_duration_sec, manual_interval_segments,
       interval_detection_source, decoupling_index,
       durability_index, temp_avg, elevation_gain, source_json, segmented_metrics, coach_comment, athlete_comment`;
const DETAIL_COLUMNS_WORK_TYPE_OVERRIDE = "manual_work_type, detected_work_type, analysis_dirty";
const DETAIL_COLUMNS_FORM_ANALYSIS = "form_analysis";
const DETAIL_COLUMNS_FEEDBACK = "athlete_feedback_rating, athlete_feedback_text";
const DETAIL_COLUMNS_ATHLETES = "athletes(first_name, last_name)";
const DETAIL_COLUMNS_STREAMS_AND_LAPS = "activity_streams, garmin_laps";

type DetailSelectAttempt = {
  includeStreamsAndLaps: boolean;
  includeFeedback: boolean;
  includeWorkTypeOverride: boolean;
  includeFormAnalysis: boolean;
};

const DETAIL_SELECT_ATTEMPTS: DetailSelectAttempt[] = [
  {
    includeStreamsAndLaps: true,
    includeFeedback: true,
    includeWorkTypeOverride: true,
    includeFormAnalysis: true,
  },
  {
    includeStreamsAndLaps: false,
    includeFeedback: true,
    includeWorkTypeOverride: true,
    includeFormAnalysis: true,
  },
  {
    includeStreamsAndLaps: false,
    includeFeedback: false,
    includeWorkTypeOverride: true,
    includeFormAnalysis: true,
  },
  {
    includeStreamsAndLaps: false,
    includeFeedback: false,
    includeWorkTypeOverride: false,
    includeFormAnalysis: true,
  },
  {
    includeStreamsAndLaps: false,
    includeFeedback: false,
    includeWorkTypeOverride: false,
    includeFormAnalysis: false,
  },
];

function buildActivityDetailSelect(attempt: DetailSelectAttempt): string {
  const columns = [DETAIL_COLUMNS_CORE];

  if (attempt.includeWorkTypeOverride) {
    columns.push(DETAIL_COLUMNS_WORK_TYPE_OVERRIDE);
  }
  if (attempt.includeFormAnalysis) {
    columns.push(DETAIL_COLUMNS_FORM_ANALYSIS);
  }
  if (attempt.includeFeedback) {
    columns.push(DETAIL_COLUMNS_FEEDBACK);
  }
  if (attempt.includeStreamsAndLaps) {
    columns.push(DETAIL_COLUMNS_STREAMS_AND_LAPS);
  }

  columns.push(DETAIL_COLUMNS_ATHLETES);
  return columns.join(", ");
}

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703";
}

async function selectActivityDetailWithFallbacks(id: string) {
  let lastError: { code?: string; message?: string } | null = null;

  for (const attempt of DETAIL_SELECT_ATTEMPTS) {
    const { data, error } = await supabase
      .from("activities")
      .select(buildActivityDetailSelect(attempt))
      .eq("id", id)
      .single();

    if (!error) {
      return data;
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  throw lastError;
}

export async function getActivityDetail(
  id: string
): Promise<{ activity: Activity; intervals: ActivityInterval[] }> {
  const activity = await selectActivityDetailWithFallbacks(id);

  const { data: intervals, error: intErr } = await supabase
    .from("activity_intervals")
    .select("*")
    .eq("activity_id", id)
    .order("start_time", { ascending: true });

  if (intErr) throw intErr;

  const athletesValue = (activity as unknown as { athletes?: unknown }).athletes;
  const normalizedAthletes = Array.isArray(athletesValue)
    ? ((athletesValue[0] as { first_name: string; last_name: string } | undefined) ?? null)
    : ((athletesValue as { first_name: string; last_name: string } | null | undefined) ?? null);

  return {
    activity: {
      ...(activity as unknown as Activity),
      analysis_dirty: Boolean((activity as unknown as Activity).analysis_dirty),
      athletes: normalizedAthletes,
    },
    intervals: (intervals ?? []) as ActivityInterval[],
  };
}

export interface UpdateActivityTypeResult {
  success: boolean;
  work_type: WorkTypeValue;
  manual_work_type: WorkTypeValue | null;
  detected_work_type: WorkTypeValue | null;
  analysis_dirty: boolean;
  reprocess_dispatched: boolean;
  warning?: string | null;
}

export async function updateCoachComment(activityId: string, comment: string) {
  const { data, error } = await supabase.functions.invoke("update-coach-comment", {
    body: { activity_id: activityId, comment },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { success: true, nolio_synced: data?.nolio_synced ?? false };
}

export async function updateAthleteFeedback(activityId: string, rating: number | null, text: string) {
  const { data, error } = await supabase.functions.invoke("update-athlete-feedback", {
    body: { activity_id: activityId, rating, text },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { success: true };
}

export async function fetchActivityStreams(activityId: string) {
  const { data, error } = await supabase.functions.invoke("get-activity-streams", {
    body: { activity_id: activityId },
  });
  if (error) throw error;
  return data as { streams: StreamPoint[] | null; laps: GarminLap[] | null };
}

export async function getComparableActivities(baseActivity: Activity): Promise<ActivityComparisonCandidate[]> {
  const baseDistance = baseActivity.distance_m ?? 0;
  if (!baseActivity.athlete_id || baseDistance <= 0) return [];

  const sportKey = normalizeSportKey(baseActivity.sport_type ?? "");
  const minDistance = baseDistance * 0.8;
  const maxDistance = baseDistance * 1.2;

  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, athlete_id, session_date, sport_type, activity_name, manual_activity_name,
       duration_sec, moving_time_sec, distance_m, avg_hr, avg_power, decoupling_index`
    )
    .eq("athlete_id", baseActivity.athlete_id)
    .in("sport_type", getSportFilterValues(sportKey))
    .lt("session_date", baseActivity.session_date)
    .gte("distance_m", minDistance)
    .lte("distance_m", maxDistance)
    .neq("id", baseActivity.id)
    .order("session_date", { ascending: false })
    .limit(80);

  if (error) throw error;

  return (data ?? [])
    .filter((candidate) => (candidate.distance_m ?? 0) > 0)
    .sort((left, right) => {
      const leftGap = Math.abs((left.distance_m ?? 0) - baseDistance);
      const rightGap = Math.abs((right.distance_m ?? 0) - baseDistance);
      if (leftGap !== rightGap) return leftGap - rightGap;
      return new Date(right.session_date).getTime() - new Date(left.session_date).getTime();
    })
    .slice(0, 20) as ActivityComparisonCandidate[];
}

export async function updateManualIntervalOverrides(
  activityId: string,
  payload: ManualIntervalsUpdatePayload
) {
  const { data, error } = await supabase.functions.invoke("update-manual-overrides", {
    body: {
      activity_id: activityId,
      overrides: payload.overrides,
      manual_interval_segments: payload.manual_interval_segments,
      reset_to_auto: payload.reset_to_auto,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function updateActivityType(
  activityId: string,
  manualWorkType: WorkTypeValue | null
): Promise<UpdateActivityTypeResult> {
  const { data, error } = await supabase.functions.invoke("update-activity-type", {
    body: { activity_id: activityId, manual_work_type: manualWorkType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as UpdateActivityTypeResult;
}

export async function triggerReprocess(activityId: string) {
  const { data, error } = await supabase.functions.invoke("trigger-reprocess", {
    body: { activity_id: activityId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { success: true };
}

export async function getRecentActivities(limit = 10) {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, athlete_id, session_date, sport_type, work_type, activity_name,
       manual_activity_name, duration_sec, moving_time_sec, distance_m, load_index, avg_hr,
       athletes(first_name, last_name)`
    )
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getActivitiesCountForDay(day: Date) {
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const startOfNextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);

  const { count, error } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .gte("session_date", startOfDay.toISOString())
    .lt("session_date", startOfNextDay.toISOString());

  if (error) throw error;
  return count ?? 0;
}
