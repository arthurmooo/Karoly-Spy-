export type DecouplingState = "none" | "good" | "moderate" | "high";
export type DurabilityPenaltyState = "none" | "stable" | "moderate" | "high";

export function getDecouplingState(value: number | null | undefined): DecouplingState {
  if (value == null || !Number.isFinite(value)) return "none";
  if (value <= 5) return "good";
  if (value <= 10) return "moderate";
  return "high";
}

export function getDecouplingLabel(value: number | null | undefined): string {
  switch (getDecouplingState(value)) {
    case "good":
      return "Bon couplage";
    case "moderate":
      return "Decouplage modere";
    case "high":
      return "Decouplage significatif";
    default:
      return "N/A";
  }
}

export function isDecouplingAlert(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 5;
}

export function getDurabilityPenaltyState(value: number | null | undefined): DurabilityPenaltyState {
  if (value == null || !Number.isFinite(value)) return "none";
  if (value <= 1.1) return "stable";
  if (value <= 1.3) return "moderate";
  return "high";
}

export function getDurabilityPenaltyLabel(value: number | null | undefined): string {
  switch (getDurabilityPenaltyState(value)) {
    case "stable":
      return "Stable";
    case "moderate":
      return "Surcout modere";
    case "high":
      return "Surcout eleve";
    default:
      return "N/A";
  }
}
