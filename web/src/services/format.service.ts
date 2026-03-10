// m/s → "X'XX /km"
export function speedToPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

// secondes → "H:mm:ss" ou "mm:ss"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// mètres → "XX.X km"
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// min/km decimal → "X'XX /km"
export function formatPaceDecimal(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}
