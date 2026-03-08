import { createServiceClient } from '@/lib/supabase/service'

export interface RecentActivity {
  id: string
  athlete_name: string
  sport_type: string
  duration_sec: number | null
  load_index: number | null
  work_type: string | null
  session_date: string
}

export interface FleetAlert {
  athlete_id: string
  athlete_name: string
  type: 'inactive'
  message: string
}

export async function getRecentActivities(hours: number = 48): Promise<RecentActivity[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('activities')
    .select('id, session_date, sport_type, duration_sec, load_index, work_type, athletes!inner(first_name, last_name)')
    .gte('session_date', since)
    .order('session_date', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data ?? []).map((a) => {
    const athlete = a.athletes as { first_name: string; last_name: string }
    return {
      id: a.id,
      athlete_name: `${athlete.first_name} ${athlete.last_name}`,
      sport_type: a.sport_type,
      duration_sec: a.duration_sec,
      load_index: a.load_index,
      work_type: a.work_type,
      session_date: a.session_date,
    }
  })
}

export async function getFleetAlerts(): Promise<FleetAlert[]> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [{ data: athletes }, { data: recentActs }] = await Promise.all([
    supabase.from('athletes').select('id, first_name, last_name').eq('is_active', true),
    supabase.from('activities').select('athlete_id').gte('session_date', sevenDaysAgo),
  ])

  if (!athletes) return []

  const activeIds = new Set((recentActs ?? []).map((a) => a.athlete_id))
  const alerts: FleetAlert[] = []

  for (const athlete of athletes) {
    if (!activeIds.has(athlete.id)) {
      alerts.push({
        athlete_id: athlete.id,
        athlete_name: `${athlete.first_name} ${athlete.last_name}`,
        type: 'inactive',
        message: 'Aucune activité depuis +7j',
      })
    }
  }

  return alerts
}
