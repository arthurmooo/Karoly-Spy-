/**
 * Convert speed in m/s to pace string "M'SS" (min/km).
 * Returns null if speed is 0 or null.
 */
export function speedToPace(speedMs: number | null): string | null {
  if (!speedMs || speedMs <= 0) return null
  const totalSeconds = 1000 / speedMs
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}'${seconds.toString().padStart(2, '0')}`
}

/**
 * Convert speed in m/s to km/h.
 */
export function speedToKmh(speedMs: number | null): number | null {
  if (!speedMs || speedMs <= 0) return null
  return Math.round(speedMs * 3.6 * 10) / 10
}

/**
 * Format duration in seconds to "Xh XXmin" or "XXmin".
 */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m}min`
}

/**
 * Format distance in meters to "X.X km".
 */
export function formatDistance(meters: number | null): string | null {
  if (meters == null) return null
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Convert pace "M:SS" or "M'SS" (min/km) to speed in m/s.
 * Returns null if the format is invalid.
 */
export function paceToSpeed(paceStr: string): number | null {
  const match = paceStr.trim().match(/^(\d{1,2})[:''](\d{2})$/)
  if (!match) return null
  const totalSeconds = parseInt(match[1]) * 60 + parseInt(match[2])
  if (totalSeconds <= 0) return null
  return 1000 / totalSeconds
}
