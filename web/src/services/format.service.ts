// m/s → "X'XX /km"
export function speedToPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  let min = Math.floor(paceSec / 60);
  let sec = Math.round(paceSec % 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

// secondes → "H:mm:ss" ou "mm:ss"
export function formatDuration(seconds: number): string {
  let h = Math.floor(seconds / 3600);
  let m = Math.floor((seconds % 3600) / 60);
  let s = Math.round(seconds % 60);
  if (s === 60) { m += 1; s = 0; }
  if (m === 60) { h += 1; m = 0; }
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// mètres → "XX.X km"
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// heures décimales → "1h45" ou "55 min"
export function formatHoursHuman(hours: number): string {
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

// m/s → decimal min/km (PAS d'arrondi — l'arrondi est fait au formatage)
export function speedToPaceDecimal(ms: number): number | null {
  if (!ms || ms <= 0) return null;
  return 1000 / ms / 60;
}

// km/h → "X'XX /km" (pour les charts Tempo qui reçoivent du km/h)
export function kmhToPace(kmh: number | null | undefined): string {
  if (!kmh || kmh <= 0) return "--";
  const paceSec = 3600 / kmh;
  let min = Math.floor(paceSec / 60);
  let sec = Math.round(paceSec % 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

// min/km decimal → "X'XX /km"
export function formatPaceDecimal(minPerKm: number): string {
  let min = Math.floor(minPerKm);
  let sec = Math.round((minPerKm - min) * 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

// ── Natation (convention /100m) ──

// m/s → "X'XX /100m"
export function speedToSwimPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 100 / ms;
  let min = Math.floor(paceSec / 60);
  let sec = Math.round(paceSec % 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /100m`;
}

// m/s → decimal min/100m (PAS d'arrondi)
export function speedToSwimPaceDecimal(ms: number): number | null {
  if (!ms || ms <= 0) return null;
  return 100 / ms / 60;
}

// min/100m decimal → "X'XX /100m"
export function formatSwimPaceDecimal(minPer100m: number): string {
  let min = Math.floor(minPer100m);
  let sec = Math.round((minPer100m - min) * 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /100m`;
}

// km/h → "X'XX /100m" (pour les charts Tempo qui reçoivent du km/h)
export function kmhToSwimPace(kmh: number | null | undefined): string {
  if (!kmh || kmh <= 0) return "--";
  const ms = kmh / 3.6;
  return speedToSwimPace(ms);
}
