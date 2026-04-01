/** RPE=0 means "not yet filled by athlete". Only [1, 10] is valid. */
export function isValidRpe(rpe: number | null | undefined): rpe is number {
  return rpe != null && rpe >= 1 && rpe <= 10;
}

/** Converts RPE=0 to null, passes valid RPE through. */
export function sanitizeRpe(rpe: number | null | undefined): number | null {
  return isValidRpe(rpe) ? rpe : null;
}
