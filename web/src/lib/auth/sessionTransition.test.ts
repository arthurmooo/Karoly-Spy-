import { describe, expect, it } from "vitest";
import { resolveAuthTransition } from "@/lib/auth/sessionTransition";

describe("resolveAuthTransition", () => {
  it("blocks UI during bootstrap when a session already exists", () => {
    expect(
      resolveAuthTransition({
        event: "BOOTSTRAP",
        previousUserId: null,
        nextUserId: "user-1",
      })
    ).toEqual({
      nextKnownUserId: "user-1",
      shouldBlockUi: true,
      shouldFetchRole: true,
      shouldClearRole: false,
    });
  });

  it("keeps UI stable when SIGNED_IN is re-emitted for the same user", () => {
    expect(
      resolveAuthTransition({
        event: "SIGNED_IN",
        previousUserId: "user-1",
        nextUserId: "user-1",
      })
    ).toEqual({
      nextKnownUserId: "user-1",
      shouldBlockUi: false,
      shouldFetchRole: false,
      shouldClearRole: false,
    });
  });

  it("keeps UI stable when TOKEN_REFRESHED is emitted for the same user", () => {
    expect(
      resolveAuthTransition({
        event: "TOKEN_REFRESHED",
        previousUserId: "user-1",
        nextUserId: "user-1",
      })
    ).toEqual({
      nextKnownUserId: "user-1",
      shouldBlockUi: false,
      shouldFetchRole: false,
      shouldClearRole: false,
    });
  });

  it("clears auth state on SIGNED_OUT without keeping loading enabled", () => {
    expect(
      resolveAuthTransition({
        event: "SIGNED_OUT",
        previousUserId: "user-1",
        nextUserId: null,
      })
    ).toEqual({
      nextKnownUserId: null,
      shouldBlockUi: false,
      shouldFetchRole: false,
      shouldClearRole: true,
    });
  });

  it("blocks UI and refetches the role when the user changes", () => {
    expect(
      resolveAuthTransition({
        event: "SIGNED_IN",
        previousUserId: "user-1",
        nextUserId: "user-2",
      })
    ).toEqual({
      nextKnownUserId: "user-2",
      shouldBlockUi: true,
      shouldFetchRole: true,
      shouldClearRole: false,
    });
  });
});
