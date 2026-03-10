const BIKE_SPORTS = new Set(["bike", "velo", "vélo", "cycling"]);
const RUN_SPORTS = new Set(["run", "cap", "course", "course a pied", "course à pied", "running"]);

export function normalizePhysioSport(sport: string | null | undefined): string {
  const normalized = (sport ?? "").trim().toLowerCase();

  if (BIKE_SPORTS.has(normalized)) return "Bike";
  if (RUN_SPORTS.has(normalized)) return "Run";

  return sport ?? "";
}

export function isBikePhysioSport(sport: string | null | undefined): boolean {
  return normalizePhysioSport(sport) === "Bike";
}

export function isRunPhysioSport(sport: string | null | undefined): boolean {
  return normalizePhysioSport(sport) === "Run";
}
