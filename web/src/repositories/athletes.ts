import { createServiceClient } from '@/lib/supabase/service'
import type { Athlete } from '@/types'

export async function getAthletes(): Promise<Athlete[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('is_active', true)
    .order('last_name')

  if (error) throw error
  return data
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
