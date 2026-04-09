import type { PhysioProfileState } from "@/types/physio";

const BIKE_SPORTS = new Set(["bike", "velo", "vélo", "cycling"]);
const RUN_SPORTS = new Set(["run", "cap", "course", "course a pied", "course à pied", "running"]);
const PROFILE_STATES = new Set<PhysioProfileState>(["fresh", "semi_fatigued", "fatigued"]);

export const PHYSIO_PROFILE_STATE_ORDER: PhysioProfileState[] = ["fresh", "semi_fatigued", "fatigued"];

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

export function normalizePhysioProfileState(
  profileState: PhysioProfileState | string | null | undefined
): PhysioProfileState {
  const normalized = (profileState ?? "").trim().toLowerCase() as PhysioProfileState;
  return PROFILE_STATES.has(normalized) ? normalized : "fresh";
}

export function isFreshPhysioProfileState(
  profileState: PhysioProfileState | string | null | undefined
): boolean {
  return normalizePhysioProfileState(profileState) === "fresh";
}

export function getPhysioProfileStateLabel(
  profileState: PhysioProfileState | string | null | undefined
): string {
  switch (normalizePhysioProfileState(profileState)) {
    case "semi_fatigued":
      return "Semi-fatigué";
    case "fatigued":
      return "Fatigué";
    case "fresh":
    default:
      return "Frais";
  }
}

export function getPhysioProfileStateDescription(
  profileState: PhysioProfileState | string | null | undefined
): string {
  switch (normalizePhysioProfileState(profileState)) {
    case "semi_fatigued":
      return "Seuils ajustés pour un athlète entamé, sans fatigue majeure.";
    case "fatigued":
      return "Seuils dégradés pour les jours de fatigue installée.";
    case "fresh":
    default:
      return "Profil de référence utilisé pour le calcul MLS.";
  }
}

export function getPhysioProfileStateBadgeVariant(
  profileState: PhysioProfileState | string | null | undefined
): "emerald" | "amber" | "red" {
  switch (normalizePhysioProfileState(profileState)) {
    case "semi_fatigued":
      return "amber";
    case "fatigued":
      return "red";
    case "fresh":
    default:
      return "emerald";
  }
}
