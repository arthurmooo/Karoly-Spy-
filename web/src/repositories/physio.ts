import { createServiceClient } from '@/lib/supabase/service'
import type { PhysioProfile } from '@/types'

export async function getProfiles(athleteId: string): Promise<PhysioProfile[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('physio_profiles')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('valid_from', { ascending: false })
    .order('valid_to', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data
}

export interface InsertProfilePayload {
  athlete_id: string
  sport: 'bike' | 'run'
  lt1_hr: number | null
  lt2_hr: number | null
  lt1_power_pace: number | null
  lt2_power_pace: number | null
  cp_cs: number | null
  weight: number | null
  vma: number | null
  cp_montee: number | null
  cp_ht: number | null
  valid_from: string
}

export async function insertProfile(payload: InsertProfilePayload) {
  const supabase = createServiceClient()

  // SCD2: close current active profile for this athlete+sport (ilike for case-insensitive match)
  const { error: closeError } = await supabase
    .from('physio_profiles')
    .update({ valid_to: payload.valid_from })
    .eq('athlete_id', payload.athlete_id)
    .ilike('sport', payload.sport)
    .is('valid_to', null)

  if (closeError) throw closeError

  // Insert new profile with valid_to = null (active)
  const { error: insertError } = await supabase
    .from('physio_profiles')
    .insert({ ...payload, valid_to: null })

  if (insertError) throw insertError
}
