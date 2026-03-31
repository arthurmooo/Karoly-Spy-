export type AppRole = "admin" | "coach" | "athlete";

export function getRole(role: string | null): AppRole {
  if (role === "athlete") return "athlete";
  if (role === "admin") return "admin";
  return "coach";
}

export function isCoach(role: string | null): boolean {
  const resolvedRole = getRole(role);
  return resolvedRole === "coach" || resolvedRole === "admin";
}

export function isAthlete(role: string | null): boolean {
  return getRole(role) === "athlete";
}

export function isAdmin(role: string | null): boolean {
  return getRole(role) === "admin";
}
