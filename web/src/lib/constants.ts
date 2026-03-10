export const SPORT_ICONS: Record<string, string> = {
  CAP: "directions_run",
  COURSE: "directions_run",
  RUN: "directions_run",
  VELO: "directions_bike",
  BIKE: "directions_bike",
  VÉLO: "directions_bike",
  NAT: "pool",
  NATATION: "pool",
  SWIM: "pool",
  SKI: "downhill_skiing",
  TRI: "directions_run",
  MUSC: "fitness_center",
  STRENGTH: "fitness_center",
};

export const SPORT_COLORS: Record<string, string> = {
  CAP: "text-accent-orange",
  COURSE: "text-accent-orange",
  RUN: "text-accent-orange",
  VELO: "text-accent-blue",
  BIKE: "text-accent-blue",
  VÉLO: "text-accent-blue",
  NAT: "text-teal-500",
  NATATION: "text-teal-500",
  SWIM: "text-teal-500",
  SKI: "text-violet-500",
};

const GLOBAL_FALLBACK = { p25: 5000, p50: 15000, p75: 30000 };

export const MLS_LEVEL = (
  mls: number,
  thresholds?: { p25: number; p50: number; p75: number }
) => {
  const t = thresholds ?? GLOBAL_FALLBACK;
  if (!mls) return { bg: "#f1f5f9", label: "Repos" };
  if (mls <= t.p25) return { bg: "#bfdbfe", label: "Faible" };
  if (mls <= t.p50) return { bg: "#60a5fa", label: "Modéré" };
  if (mls <= t.p75) return { bg: "#f97316", label: "Élevé" };
  return { bg: "#ea580c", label: "Critique" };
};
