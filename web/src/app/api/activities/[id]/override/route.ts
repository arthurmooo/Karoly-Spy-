import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateIntervalOverride, type IntervalOverridePayload } from '@/services/activities'

const ALLOWED_KEYS = [
  'manual_interval_pace_mean',
  'manual_interval_pace_last',
  'manual_interval_power_mean',
  'manual_interval_power_last',
] as const

type AllowedKey = (typeof ALLOWED_KEYS)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload: IntervalOverridePayload = {}
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      const val = body[key]
      if (val !== null && typeof val !== 'number') {
        return NextResponse.json(
          { error: `${key} must be a number or null` },
          { status: 400 }
        )
      }
      payload[key as AllowedKey] = val as number | null
    }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: 'No valid override fields provided' },
      { status: 400 }
    )
  }

  try {
    await updateIntervalOverride(id, payload)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Override update failed:', err)
    return NextResponse.json(
      { error: 'Failed to update override' },
      { status: 500 }
    )
  }
}
