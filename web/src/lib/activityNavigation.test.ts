import { describe, expect, it } from "vitest";
import {
  buildActivityLinkState,
  extractActivityNavigationState,
  getActivityDetailPath,
  getDefaultActivityListPath,
  resolveActivityBackPath,
} from "@/lib/activityNavigation";

describe("activityNavigation", () => {
  it("builds a from state with pathname and search", () => {
    expect(buildActivityLinkState({ pathname: "/activities", search: "?athlete=42&page=2" })).toEqual({
      from: "/activities?athlete=42&page=2",
    });
  });

  it("extracts a valid navigation state", () => {
    expect(extractActivityNavigationState({ from: "/activities?from=2026-03-01" })).toEqual({
      from: "/activities?from=2026-03-01",
    });
  });

  it("ignores an invalid navigation state", () => {
    expect(extractActivityNavigationState({ from: "" })).toBeUndefined();
    expect(extractActivityNavigationState(null)).toBeUndefined();
    expect(extractActivityNavigationState({ nope: "/activities" })).toBeUndefined();
  });

  it("resolves back path from state when present", () => {
    expect(resolveActivityBackPath("coach", { from: "/calendar?view=week" })).toBe("/calendar?view=week");
  });

  it("falls back to the coach activities list on direct access", () => {
    expect(resolveActivityBackPath("coach", undefined)).toBe("/activities");
    expect(getDefaultActivityListPath("coach")).toBe("/activities");
  });

  it("falls back to the athlete sessions list on direct access", () => {
    expect(resolveActivityBackPath("athlete", undefined)).toBe("/mon-espace/seances");
    expect(getDefaultActivityListPath("athlete")).toBe("/mon-espace/seances");
  });

  it("builds detail paths from role", () => {
    expect(getActivityDetailPath("activity-1", "coach")).toBe("/activities/activity-1");
    expect(getActivityDetailPath("activity-1", "athlete")).toBe("/mon-espace/activities/activity-1");
  });
});
