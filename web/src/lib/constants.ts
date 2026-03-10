export const SPORT_ICONS: Record<string, string> = {
  CAP: "directions_run",
  VELO: "directions_bike",
  NAT: "pool",
  SKI: "downhill_skiing",
  TRI: "directions_run",
  MUSC: "fitness_center",
};

export const SPORT_COLORS: Record<string, string> = {
  CAP: "text-accent-orange",
  VELO: "text-accent-blue",
  NAT: "text-teal-500",
  SKI: "text-violet-500",
};

export const MLS_LEVEL = (mls: number) => {
  if (mls < 2) return { bg: "#f1f5f9", label: "Repos" };
  if (mls < 4) return { bg: "#bfdbfe", label: "Faible" };
  if (mls < 6) return { bg: "#60a5fa", label: "Modéré" };
  if (mls < 8) return { bg: "#f97316", label: "Élevé" };
  return { bg: "#ea580c", label: "Critique" };
};
