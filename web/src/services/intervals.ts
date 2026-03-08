export interface StreamData {
  elapsed_sec: number[]
  heart_rate: (number | null)[]
  speed: (number | null)[]
  power: (number | null)[]
  altitude: (number | null)[]
  distance: (number | null)[]
}

export interface DetectedSegment {
  startSec: number
  endSec: number
  avgValue: number
  avgHr: number | null
  avgSpeed: number | null
  avgPower: number | null
}

export type MetricKey = 'speed' | 'power' | 'heart_rate'

function avgNonNull(arr: (number | null)[], start: number, end: number): number | null {
  let sum = 0
  let count = 0
  for (let i = start; i <= end; i++) {
    const v = arr[i]
    if (v != null) {
      sum += v
      count++
    }
  }
  return count > 0 ? sum / count : null
}

export function findBestSegments(
  streams: StreamData,
  metric: MetricKey,
  durationSec: number,
  count: number
): DetectedSegment[] {
  const values = streams[metric]
  const n = values.length

  if (n < durationSec || durationSec <= 0 || count <= 0) return []

  // Build rolling sum with non-null count
  const windowAvgs: { idx: number; avg: number }[] = []

  let sum = 0
  let nonNullCount = 0
  // Initialize first window
  for (let i = 0; i < durationSec; i++) {
    const v = values[i]
    if (v != null) {
      sum += v
      nonNullCount++
    }
  }
  if (nonNullCount > 0) {
    windowAvgs.push({ idx: 0, avg: sum / nonNullCount })
  }

  // Slide the window
  for (let i = 1; i <= n - durationSec; i++) {
    const leaving = values[i - 1]
    const entering = values[i + durationSec - 1]
    if (leaving != null) {
      sum -= leaving
      nonNullCount--
    }
    if (entering != null) {
      sum += entering
      nonNullCount++
    }
    if (nonNullCount > 0) {
      windowAvgs.push({ idx: i, avg: sum / nonNullCount })
    }
  }

  // Sort by avg descending
  windowAvgs.sort((a, b) => b.avg - a.avg)

  // Greedy non-overlapping selection
  const selected: DetectedSegment[] = []
  const usedRanges: [number, number][] = []

  for (const candidate of windowAvgs) {
    if (selected.length >= count) break

    const startSec = candidate.idx
    const endSec = startSec + durationSec - 1

    // Check overlap with already selected
    const overlaps = usedRanges.some(
      ([s, e]) => startSec <= e && endSec >= s
    )
    if (overlaps) continue

    usedRanges.push([startSec, endSec])
    selected.push({
      startSec,
      endSec,
      avgValue: candidate.avg,
      avgHr: avgNonNull(streams.heart_rate, startSec, endSec),
      avgSpeed: avgNonNull(streams.speed, startSec, endSec),
      avgPower: avgNonNull(streams.power, startSec, endSec),
    })
  }

  // Sort by startSec ascending
  selected.sort((a, b) => a.startSec - b.startSec)
  return selected
}

export function findBestSegmentsByDistance(
  streams: StreamData,
  metric: MetricKey,
  distanceMeters: number,
  count: number
): DetectedSegment[] {
  const values = streams[metric]
  const dist = streams.distance
  const n = values.length

  if (n === 0 || distanceMeters <= 0 || count <= 0) return []

  // Two-pointer: for each i, find smallest j where dist[j] - dist[i] >= distanceMeters
  const candidates: { idx: number; endIdx: number; avg: number }[] = []
  let j = 0

  for (let i = 0; i < n; i++) {
    if (dist[i] == null) continue

    // Advance j until distance threshold met
    if (j <= i) j = i + 1
    while (j < n && (dist[j] == null || dist[j]! - dist[i]! < distanceMeters)) {
      j++
    }
    if (j >= n) break

    // Compute avg of metric over [i, j]
    const avg = avgNonNull(values, i, j)
    if (avg != null) {
      candidates.push({ idx: i, endIdx: j, avg })
    }
  }

  // Sort by avg descending
  candidates.sort((a, b) => b.avg - a.avg)

  // Greedy non-overlapping selection
  const selected: DetectedSegment[] = []
  const usedRanges: [number, number][] = []

  for (const candidate of candidates) {
    if (selected.length >= count) break

    const startSec = candidate.idx
    const endSec = candidate.endIdx

    const overlaps = usedRanges.some(
      ([s, e]) => startSec <= e && endSec >= s
    )
    if (overlaps) continue

    usedRanges.push([startSec, endSec])
    selected.push({
      startSec,
      endSec,
      avgValue: candidate.avg,
      avgHr: avgNonNull(streams.heart_rate, startSec, endSec),
      avgSpeed: avgNonNull(streams.speed, startSec, endSec),
      avgPower: avgNonNull(streams.power, startSec, endSec),
    })
  }

  selected.sort((a, b) => a.startSec - b.startSec)
  return selected
}
