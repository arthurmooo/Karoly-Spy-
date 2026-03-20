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

export const SPORT_CONFIG = [
  { key: "Course à pied", dbKey: "Run", aliases: ["Run", "CAP", "COURSE", "RUN", "Course", "Course à pied"], label: "Course à pied", icon: "directions_run", textColor: "text-accent-orange", bgColor: "bg-accent-orange", bgLight: "bg-accent-orange/10", border: "border-accent-orange" },
  { key: "Vélo", dbKey: "Bike", aliases: ["Bike", "VELO", "BIKE", "VÉLO"], label: "Vélo", icon: "directions_bike", textColor: "text-accent-blue", bgColor: "bg-accent-blue", bgLight: "bg-accent-blue/10", border: "border-accent-blue" },
  { key: "Natation", dbKey: "Swim", aliases: ["Swim", "NAT", "NATATION", "SWIM"], label: "Natation", icon: "pool", textColor: "text-teal-600", bgColor: "bg-teal-500", bgLight: "bg-teal-500/10", border: "border-teal-500" },
  { key: "Ski", dbKey: "Ski", aliases: ["SKI"], label: "Ski", icon: "downhill_skiing", textColor: "text-violet-600", bgColor: "bg-violet-500", bgLight: "bg-violet-500/10", border: "border-violet-500" },
  { key: "Musculation", dbKey: "Strength", aliases: ["Strength", "MUSC", "STRENGTH"], label: "Musculation", icon: "fitness_center", textColor: "text-slate-600", bgColor: "bg-slate-400", bgLight: "bg-slate-200", border: "border-slate-400" },
] as const;

export const DEFAULT_SPORT_CONFIG = { icon: "exercise", textColor: "text-slate-600", bgColor: "bg-slate-400", bgLight: "bg-slate-200", border: "border-slate-400" } as const;

export function getSportConfig(sport: string) {
  return SPORT_CONFIG.find(s => s.key === sport || s.dbKey === sport || (s.aliases as readonly string[]).includes(sport)) ?? { ...DEFAULT_SPORT_CONFIG, key: sport, label: sport };
}

const GLOBAL_FALLBACK = { p25: 5000, p50: 15000, p75: 30000 };


export const HR_ZONE_COLORS = {
  Z1i: "#bfdbfe", // blue-200
  Z1ii: "#60a5fa", // blue-400
  Z2i: "#4ade80", // green-400
  Z2ii: "#facc15", // yellow-400
  Z3i: "#f97316", // orange-500
  Z3ii: "#ef4444", // red-500
} as const;

export const HR_ZONE_LABELS: Record<string, string> = {
  Z1i: "Z1i",
  Z1ii: "Z1ii",
  Z2i: "Z2i",
  Z2ii: "Z2ii",
  Z3i: "Z3i",
  Z3ii: "Z3ii",
};

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
