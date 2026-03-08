import { getFleetLoad, type WeeklyLoadRow } from '@/repositories/load'

export interface HeatmapData {
  athletes: string[]
  weeks: string[]
  grid: (number | null)[][]
  raw: (number | null)[][]
}

export async function getFleetHeatmapData(weeks: number = 12): Promise<HeatmapData> {
  const rows = await getFleetLoad(weeks)

  const athleteSet = new Set<string>()
  const weekSet = new Set<string>()
  for (const r of rows) {
    athleteSet.add(r.athlete)
    weekSet.add(r.week_start)
  }
  const athletes = [...athleteSet].sort()
  const weeksSorted = [...weekSet].sort()

  const lookup = new Map<string, number | null>()
  for (const r of rows) {
    lookup.set(`${r.athlete}|${r.week_start}`, r.mls_hebdo)
  }

  const raw = athletes.map(a =>
    weeksSorted.map(w => lookup.get(`${a}|${w}`) ?? null)
  )

  let maxMls = 0
  for (const row of raw)
    for (const v of row)
      if (v != null && v > maxMls) maxMls = v

  const grid = raw.map(row =>
    row.map(v => (v != null && maxMls > 0 ? v / maxMls : null))
  )

  const weekLabels = weeksSorted.map(w => {
    const d = new Date(w + 'T00:00:00')
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  })

  return { athletes, weeks: weekLabels, grid, raw }
}

export type { WeeklyLoadRow }
