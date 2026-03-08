import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertProfile } from '@/services/physio'

const VALID_SPORTS = ['bike', 'run'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { athlete_id, sport, valid_from } = body
  if (!athlete_id || typeof athlete_id !== 'string') {
    return NextResponse.json({ error: 'athlete_id is required' }, { status: 400 })
  }
  if (!sport || !VALID_SPORTS.includes(sport as (typeof VALID_SPORTS)[number])) {
    return NextResponse.json({ error: 'sport must be bike or run' }, { status: 400 })
  }
  if (!valid_from || typeof valid_from !== 'string') {
    return NextResponse.json({ error: 'valid_from is required (ISO date)' }, { status: 400 })
  }

  const numOrNull = (key: string): number | null => {
    const val = body[key]
    if (val === null || val === undefined || val === '') return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  try {
    await insertProfile({
      athlete_id: athlete_id as string,
      sport: sport as 'bike' | 'run',
      valid_from: valid_from as string,
      lt1_hr: numOrNull('lt1_hr'),
      lt2_hr: numOrNull('lt2_hr'),
      lt1_power_pace: numOrNull('lt1_power_pace'),
      lt2_power_pace: numOrNull('lt2_power_pace'),
      cp_cs: numOrNull('cp_cs'),
      weight: numOrNull('weight'),
      vma: numOrNull('vma'),
      cp_montee: numOrNull('cp_montee'),
      cp_ht: numOrNull('cp_ht'),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Insert profile failed:', err)
    return NextResponse.json({ error: 'Failed to insert profile' }, { status: 500 })
  }
}
