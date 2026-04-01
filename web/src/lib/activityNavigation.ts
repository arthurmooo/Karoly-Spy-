import { isCoach } from "@/lib/auth/roles";

export interface ActivityNavigationState {
  from?: string;
}

interface LocationLike {
  pathname: string;
  search?: string;
  state?: unknown;
}

export function getDefaultActivityListPath(role: string | null): string {
  return isCoach(role) ? "/activities" : "/mon-espace/seances";
}

export function getActivityDetailPath(id: string, role: string | null): string {
  return isCoach(role) ? `/activities/${id}` : `/mon-espace/activities/${id}`;
}

export function buildActivityLinkState(location: Pick<LocationLike, "pathname" | "search">): ActivityNavigationState {
  return {
    from: `${location.pathname}${location.search ?? ""}`,
  };
}

export function extractActivityNavigationState(state: unknown): ActivityNavigationState | undefined {
  if (typeof state !== "object" || state === null) return undefined;

  const from = (state as ActivityNavigationState).from;
  if (typeof from !== "string" || from.length === 0) return undefined;

  return { from };
}

export function resolveActivityBackPath(role: string | null, state: unknown): string {
  const navigationState = extractActivityNavigationState(state);
  return navigationState?.from ?? getDefaultActivityListPath(role);
}
