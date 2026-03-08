import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import FitParser from 'fit-file-parser'

export async function GET(
  _request: NextRequest,
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

  // Get activity fit_file_path
  const admin = createServiceClient()
  const { data: activity, error: actError } = await admin
    .from('activities')
    .select('fit_file_path')
    .eq('id', id)
    .single()

  if (actError || !activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  if (!activity.fit_file_path) {
    return NextResponse.json(
      { error: 'No FIT file available for this activity' },
      { status: 404 }
    )
  }

  // Download FIT from Supabase Storage
  const { data: fileData, error: dlError } = await admin.storage
    .from('raw_fits')
    .download(activity.fit_file_path)

  if (dlError || !fileData) {
    return NextResponse.json(
      { error: 'Failed to download FIT file' },
      { status: 500 }
    )
  }

  // Parse FIT file
  const buffer = await fileData.arrayBuffer()
  const parser = new FitParser({ speedUnit: 'ms', lengthUnit: 'm', force: true })

  let parsed
  try {
    parsed = await parser.parseAsync(Buffer.from(buffer))
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse FIT file' },
      { status: 500 }
    )
  }

  const records = parsed?.records ?? []
  if (records.length === 0) {
    return NextResponse.json({ error: 'No records in FIT file' }, { status: 404 })
  }

  // Resample to 1Hz using timestamp
  const firstTs = new Date(records[0].timestamp).getTime()
  const streamMap = new Map<
    number,
    { hr: number[]; speed: number[]; power: number[]; cadence: number[]; distance: number[]; altitude: number[] }
  >()

  for (const r of records) {
    const elapsed = Math.round((new Date(r.timestamp).getTime() - firstTs) / 1000)
    if (elapsed < 0) continue

    if (!streamMap.has(elapsed)) {
      streamMap.set(elapsed, { hr: [], speed: [], power: [], cadence: [], distance: [], altitude: [] })
    }
    const bucket = streamMap.get(elapsed)!
    if (r.heart_rate != null) bucket.hr.push(r.heart_rate)
    const spd = r.enhanced_speed ?? r.speed
    if (spd != null) bucket.speed.push(spd)
    if (r.power != null) bucket.power.push(r.power)
    if (r.cadence != null) bucket.cadence.push(r.cadence)
    if (r.distance != null) bucket.distance.push(r.distance)
    const alt = r.enhanced_altitude ?? r.altitude
    if (alt != null) bucket.altitude.push(alt)
  }

  const maxSec = Math.max(...streamMap.keys())
  const elapsed_sec: number[] = []
  const heart_rate: (number | null)[] = []
  const speed: (number | null)[] = []
  const power: (number | null)[] = []
  const cadence: (number | null)[] = []
  const distance: (number | null)[] = []
  const altitude: (number | null)[] = []

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  for (let s = 0; s <= maxSec; s++) {
    elapsed_sec.push(s)
    const bucket = streamMap.get(s)
    if (bucket) {
      heart_rate.push(avg(bucket.hr))
      speed.push(avg(bucket.speed))
      power.push(avg(bucket.power))
      cadence.push(avg(bucket.cadence))
      distance.push(bucket.distance.length > 0 ? bucket.distance[bucket.distance.length - 1] : null)
      altitude.push(avg(bucket.altitude))
    } else {
      heart_rate.push(null)
      speed.push(null)
      power.push(null)
      cadence.push(null)
      distance.push(null)
      altitude.push(null)
    }
  }

  return NextResponse.json(
    { elapsed_sec, heart_rate, speed, power, cadence, distance, altitude },
    {
      headers: {
        'Cache-Control': 'private, max-age=3600',
      },
    }
  )
}
