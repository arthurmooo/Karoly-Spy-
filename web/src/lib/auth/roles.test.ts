import { describe, expect, it } from "vitest";
import { getRole, isAdmin, isAthlete, isCoach } from "@/lib/auth/roles";

describe("auth roles", () => {
  it("defaults unknown roles to coach", () => {
    expect(getRole(null)).toBe("coach");
    expect(getRole("unexpected")).toBe("coach");
  });

  it("keeps athlete and admin roles explicit", () => {
    expect(getRole("athlete")).toBe("athlete");
    expect(getRole("admin")).toBe("admin");
  });

  it("treats admin as coach-capable without making it an athlete", () => {
    expect(isCoach("admin")).toBe(true);
    expect(isAdmin("admin")).toBe(true);
    expect(isAthlete("admin")).toBe(false);
  });
});
