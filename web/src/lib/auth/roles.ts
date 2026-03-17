export type AppRole = "coach" | "athlete";

export function getRole(role: string | null): AppRole {
  return role === "athlete" ? "athlete" : "coach";
}

export function isCoach(role: string | null): boolean {
  return getRole(role) !== "athlete";
}

export function isAthlete(role: string | null): boolean {
  return getRole(role) === "athlete";
}
