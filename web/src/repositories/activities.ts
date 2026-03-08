import { createServiceClient } from '@/lib/supabase/service'

const PAGE_SIZE = 25

const ACTIVITY_SELECT = `
  id,
  session_date,
  sport_type,
  work_type,
  activity_name,
  duration_sec,
  distance_m,
  load_index,
  avg_hr,
  avg_power,
  interval_pace_mean,
  interval_pace_last,
  manual_interval_pace_mean,
  manual_interval_pace_last,
  manual_interval_power_mean,
  manual_interval_power_last,
  rpe,
  athlete_id,
  athletes!inner ( first_name, last_name )
` as const

export interface ActivityFilters {
  athleteId?: string
  sport?: string
  dateFrom?: string
  dateTo?: string
}

export async function getActivities(page: number = 1, filters: ActivityFilters = {}) {
  const supabase = createServiceClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('activities')
    .select(ACTIVITY_SELECT, { count: 'exact' })

  if (filters.athleteId) query = query.eq('athlete_id', filters.athleteId)
  if (filters.sport) query = query.eq('sport_type', filters.sport)
  if (filters.dateFrom) query = query.gte('session_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('session_date', filters.dateTo)

  const { data, error, count } = await query
    .order('session_date', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { data: data ?? [], count: count ?? 0, pageSize: PAGE_SIZE }
}

const ALLOWED_OVERRIDE_KEYS = [
  'manual_interval_pace_mean',
  'manual_interval_pace_last',
  'manual_interval_power_mean',
  'manual_interval_power_last',
] as const

type OverrideKey = (typeof ALLOWED_OVERRIDE_KEYS)[number]
export type IntervalOverridePayload = Partial<Record<OverrideKey, number | null>>

export async function getActivityById(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('activities')
    .select(`
      id, session_date, sport_type, work_type, activity_name,
      duration_sec, distance_m, load_index, avg_hr, avg_power,
      interval_pace_mean, interval_pace_last,
      manual_interval_pace_mean, manual_interval_pace_last,
      manual_interval_power_mean, manual_interval_power_last,
      fit_file_path, athlete_id,
      athletes!inner ( first_name, last_name )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateIntervalOverride(
  activityId: string,
  payload: IntervalOverridePayload
) {
  // Whitelist keys
  const sanitized: Record<string, number | null> = {}
  for (const key of ALLOWED_OVERRIDE_KEYS) {
    if (key in payload) {
      sanitized[key] = payload[key] ?? null
    }
  }
  if (Object.keys(sanitized).length === 0) return

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('activities')
    .update(sanitized)
    .eq('id', activityId)
  if (error) throw error
}
