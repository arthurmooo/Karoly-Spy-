import { createServiceClient } from '@/lib/supabase/service'

export interface HrvRow {
  athlete_id: string
  date: string
  resting_hr: number
  rmssd: number
}

export async function resolveAthleteByEmail(email: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .single()

  if (error || !data) return null
  return data.id
}

const BATCH_SIZE = 200

export async function upsertHrvBatch(rows: HrvRow[]) {
  if (rows.length === 0) return { imported: 0 }

  const supabase = createServiceClient()

  // Deduplicate by (athlete_id, date) — keep last occurrence
  const deduped = new Map<string, HrvRow>()
  for (const r of rows) {
    deduped.set(`${r.athlete_id}|${r.date}`, r)
  }
  const uniqueRows = Array.from(deduped.values())

  // Upsert in chunks to avoid PostgREST payload limits
  for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
    const chunk = uniqueRows.slice(i, i + BATCH_SIZE).map((r) => ({
      athlete_id: r.athlete_id,
      date: r.date,
      resting_hr: r.resting_hr,
      rmssd: r.rmssd,
    }))

    const { error } = await supabase
      .from('daily_readiness')
      .upsert(chunk, {
        onConflict: 'athlete_id,date',
        ignoreDuplicates: false,
      })

    if (error) throw error
  }

  return { imported: uniqueRows.length }
}

export interface HealthRadarRow {
  athlete_id: string | null
  athlete: string | null
  date: string | null
  rmssd_matinal: number | null
  fc_repos: number | null
  tendance_rmssd_pct: number | null
  poids: number | null
}

export async function getHealthRadar(): Promise<HealthRadarRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('view_health_radar')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  return (data ?? []) as HealthRadarRow[]
}

export async function getHealthRadarForAthlete(
  athleteId: string,
): Promise<HealthRadarRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('view_health_radar')
    .select('*')
    .eq('athlete_id', athleteId)

  if (error) throw error
  return (data ?? []) as HealthRadarRow[]
}

export interface HrvSeriesRow {
  date: string
  rmssd: number | null
  resting_hr: number | null
  rmssd_30d_avg: number | null
  resting_hr_30d_avg: number | null
}

export async function getHrvSeries(
  athleteId: string,
  days: number,
): Promise<HrvSeriesRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('daily_readiness')
    .select('date, rmssd, resting_hr, rmssd_30d_avg, resting_hr_30d_avg')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: true })
    .gte(
      'date',
      new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
    )

  if (error) throw error
  return data ?? []
}
