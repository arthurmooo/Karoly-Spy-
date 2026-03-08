export function speedToPace(speedMs: number | null): string | null {
  if (!speedMs || speedMs <= 0) return null
  const totalSeconds = 1000 / speedMs
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}'${seconds.toString().padStart(2, '0')}`
}

export function speedToKmh(speedMs: number | null): number | null {
  if (!speedMs || speedMs <= 0) return null
  return Math.round(speedMs * 3.6 * 10) / 10
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m}min`
}

export function formatDistance(meters: number | null): string | null {
  if (meters == null) return null
  return `${(meters / 1000).toFixed(1)} km`
}

export function paceToSpeed(paceStr: string): number | null {
  const match = paceStr.trim().match(/^(\d{1,2})[:''](\d{2})$/)
  if (!match) return null
  const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2])
  if (totalSeconds <= 0) return null
  return 1000 / totalSeconds
}
