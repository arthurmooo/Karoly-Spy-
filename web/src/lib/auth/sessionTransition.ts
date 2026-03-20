import type { AuthChangeEvent } from "@supabase/supabase-js";

export interface AuthTransitionInput {
  event: AuthChangeEvent | "BOOTSTRAP";
  previousUserId: string | null;
  nextUserId: string | null;
}

export interface AuthTransitionDecision {
  nextKnownUserId: string | null;
  shouldBlockUi: boolean;
  shouldFetchRole: boolean;
  shouldClearRole: boolean;
}

export function resolveAuthTransition({
  event,
  previousUserId,
  nextUserId,
}: AuthTransitionInput): AuthTransitionDecision {
  if (event === "BOOTSTRAP") {
    return {
      nextKnownUserId: nextUserId,
      shouldBlockUi: nextUserId !== null,
      shouldFetchRole: nextUserId !== null,
      shouldClearRole: nextUserId === null,
    };
  }

  if (event === "SIGNED_OUT" || nextUserId === null) {
    return {
      nextKnownUserId: null,
      shouldBlockUi: false,
      shouldFetchRole: false,
      shouldClearRole: true,
    };
  }

  const isUserChanged = previousUserId !== nextUserId;

  return {
    nextKnownUserId: nextUserId,
    shouldBlockUi: isUserChanged,
    shouldFetchRole: isUserChanged,
    shouldClearRole: false,
  };
}
