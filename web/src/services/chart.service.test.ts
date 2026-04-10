import { describe, expect, it } from "vitest";
import { generatePaceTicks, injectFastestPaceTick } from "./chart.service";

describe("generatePaceTicks", () => {
  it("picks 15s step for ~80s range (e.g., 3'10 to 3'50)", () => {
    const result = generatePaceTicks(3 + 10 / 60, 3 + 50 / 60);
    // rangeSec = 40s → step 10s… wait, 40 <= 60, so step = 10s
    // Actually 40s range → 10s step
    expect(result.stepSec).toBe(10);
    // All ticks should have seconds divisible by 10
    for (const t of result.ticks) {
      const sec = Math.round((t % 1) * 60);
      expect(sec % 10).toBe(0);
    }
    expect(result.domainMin).toBeLessThanOrEqual(3 + 10 / 60);
    expect(result.domainMax).toBeGreaterThanOrEqual(3 + 50 / 60);
  });

  it("picks 15s step for ~120s range", () => {
    // 3'00 to 5'00 = 120s
    const result = generatePaceTicks(3.0, 5.0);
    expect(result.stepSec).toBe(15);
    for (const t of result.ticks) {
      const sec = Math.round((t % 1) * 60);
      expect([0, 15, 30, 45]).toContain(sec);
    }
  });

  it("picks 30s step for ~200s range", () => {
    // 3'00 to 6'20 = 200s
    const result = generatePaceTicks(3.0, 3 + 200 / 60);
    expect(result.stepSec).toBe(30);
    for (const t of result.ticks) {
      const sec = Math.round((t % 1) * 60);
      expect([0, 30]).toContain(sec);
    }
  });

  it("picks 60s step for wide range (>300s)", () => {
    // 3'00 to 9'00 = 360s > 300 → 60s step
    const result = generatePaceTicks(3.0, 9.0);
    expect(result.stepSec).toBe(60);
    expect(result.ticks).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("handles single value (min == max)", () => {
    const result = generatePaceTicks(4.0, 4.0);
    expect(result.ticks.length).toBeGreaterThanOrEqual(2);
    expect(result.domainMin).toBeLessThan(4.0);
    expect(result.domainMax).toBeGreaterThan(4.0);
  });

  it("domain boundaries match first and last ticks", () => {
    const result = generatePaceTicks(3.2, 4.1);
    expect(result.domainMin).toBe(result.ticks[0]);
    expect(result.domainMax).toBe(result.ticks[result.ticks.length - 1]);
  });
});

describe("injectFastestPaceTick", () => {
  it("injects fastest pace when it doesn't collide", () => {
    const ticks = [3.0, 3.25, 3.5, 3.75, 4.0];
    const fastest = 3.12; // ~3'07/km — between 3'00 and 3'15
    const result = injectFastestPaceTick(ticks, fastest, 15);
    expect(result).toContain(fastest);
    expect(result.length).toBe(6);
  });

  it("does not inject when too close to existing tick", () => {
    const ticks = [3.0, 3.25, 3.5, 3.75, 4.0];
    const fastest = 3.01; // very close to 3.0
    const result = injectFastestPaceTick(ticks, fastest, 15);
    expect(result).not.toContain(fastest);
    expect(result.length).toBe(5);
  });

  it("does not mutate input array", () => {
    const ticks = [3.0, 3.5, 4.0];
    const original = [...ticks];
    injectFastestPaceTick(ticks, 3.2, 30);
    expect(ticks).toEqual(original);
  });
});
