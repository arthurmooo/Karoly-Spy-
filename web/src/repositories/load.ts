import { createServiceClient } from '@/lib/supabase/service'

export interface WeeklyLoadRow {
  athlete: string
  week_start: string
  mls_hebdo: number | null
  heures_hebdo: number | null
  nb_seances: number
}

export async function getFleetLoad(weeks: number = 12): Promise<WeeklyLoadRow[]> {
  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('view_weekly_monitoring' as any)
    .select('athlete, week_start, mls_hebdo, heures_hebdo, nb_seances')
    .gte('week_start', cutoff.toISOString().split('T')[0])
    .order('week_start', { ascending: true })

  if (error) throw error
  return data as unknown as WeeklyLoadRow[]
}
