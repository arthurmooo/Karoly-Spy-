import { describe, expect, it } from "vitest";
import { generateInsights } from "./analysis.service";
import type { NormalizedStatsActivity } from "./stats.service";

let rowCounter = 0;
function makeRow(overrides: Partial<NormalizedStatsActivity> = {}): NormalizedStatsActivity {
  rowCounter += 1;
  return {
    activityId: overrides.activityId ?? `test-id-${rowCounter}`,
    sessionDate: new Date("2026-03-10"),
    sportKey: "run",
    sportLabel: "Course à pied",
    distanceM: 10000,
    durationSec: 3600,
    loadIndex: 80,
    rpe: 5,
    decouplingIndex: 4,
    durabilityIndex: 0.9,
    avgHr: 150,
    workType: "endurance",
    activityName: "Footing",
    segmentedMetrics: null,
    ...overrides,
  };
}

describe("generateInsights", () => {
  it("returns empty insights when no rows", () => {
    const result = generateInsights([], []);
    expect(result.insights).toHaveLength(0);
    expect(result.focusAlert).toBeNull();
  });

  it("detects volume increase > 20%", () => {
    const current = [makeRow({ distanceM: 15000 })];
    const previous = [makeRow({ distanceM: 10000 })];
    const result = generateInsights(current, previous);
    const vol = result.insights.find((i) => i.id === "volume-delta");
    expect(vol).toBeDefined();
    expect(vol!.title).toContain("hausse");
    expect(vol!.title).toContain("50");
  });

  it("detects volume decrease > 20%", () => {
    const current = [makeRow({ distanceM: 7000 })];
    const previous = [makeRow({ distanceM: 10000 })];
    const result = generateInsights(current, previous);
    const vol = result.insights.find((i) => i.id === "volume-delta");
    expect(vol).toBeDefined();
    expect(vol!.title).toContain("baisse");
  });

  it("skips volume delta when < 20%", () => {
    const current = [makeRow({ distanceM: 11000 })];
    const previous = [makeRow({ distanceM: 10000 })];
    const result = generateInsights(current, previous);
    expect(result.insights.find((i) => i.id === "volume-delta")).toBeUndefined();
  });

  it("detects high load delta > 30%", () => {
    const current = [makeRow({ loadIndex: 200 })];
    const previous = [makeRow({ loadIndex: 100 })];
    const result = generateInsights(current, previous);
    const load = result.insights.find((i) => i.id === "load-high");
    expect(load).toBeDefined();
    expect(load!.severity).toBe("warning");
  });

  it("detects high average decoupling > 10%", () => {
    const current = [makeRow({ decouplingIndex: 12 }), makeRow({ decouplingIndex: 14 })];
    const result = generateInsights(current, []);
    const dec = result.insights.find((i) => i.id === "decoupling-high");
    expect(dec).toBeDefined();
    expect(dec!.title).toContain("13,0");
  });

  it("detects good coupling < 3%", () => {
    const current = [makeRow({ decouplingIndex: 2 }), makeRow({ decouplingIndex: 2.5 })];
    const result = generateInsights(current, []);
    const good = result.insights.find((i) => i.id === "decoupling-good");
    expect(good).toBeDefined();
    expect(good!.title).toContain("Excellent");
  });

  it("treats negative decoupling as favorable", () => {
    const current = [makeRow({ decouplingIndex: -4.2 })];
    const result = generateInsights(current, []);
    expect(result.focusAlert).toBeNull();
    expect(result.insights.find((i) => i.id === "decoupling-high")).toBeUndefined();
  });

  it("detects decoupling delta > 3pts", () => {
    const current = [makeRow({ decouplingIndex: 10 })];
    const previous = [makeRow({ decouplingIndex: 5 })];
    const result = generateInsights(current, previous);
    const dec = result.insights.find((i) => i.id === "decoupling-delta");
    expect(dec).toBeDefined();
    expect(dec!.title).toContain("hausse");
  });

  it("detects elevated durability penalty", () => {
    const current = [makeRow({ durabilityIndex: 1.16 }), makeRow({ durabilityIndex: 1.22 })];
    const result = generateInsights(current, []);
    const dur = result.insights.find((i) => i.id === "durability-penalty");
    expect(dur).toBeDefined();
    expect(dur!.severity).toBe("warning");
  });

  it("detects high RPE > 7", () => {
    const current = [makeRow({ rpe: 8 }), makeRow({ rpe: 7.5 })];
    const result = generateInsights(current, []);
    const rpe = result.insights.find((i) => i.id === "rpe-high");
    expect(rpe).toBeDefined();
    expect(rpe!.title).toContain("RPE");
  });

  it("detects RPE delta > 1pt", () => {
    const current = [makeRow({ rpe: 8 })];
    const previous = [makeRow({ rpe: 6 })];
    const result = generateInsights(current, previous);
    const rpe = result.insights.find((i) => i.id === "rpe-delta");
    expect(rpe).toBeDefined();
    expect(rpe!.title).toContain("hausse");
  });

  it("flags low session count < 3", () => {
    const current = [makeRow(), makeRow()];
    const result = generateInsights(current, []);
    const sess = result.insights.find((i) => i.id === "sessions-low");
    expect(sess).toBeDefined();
    expect(sess!.title).toContain("2 séances");
  });

  it("does not flag low session count when >= 3", () => {
    const current = [makeRow(), makeRow(), makeRow()];
    const result = generateInsights(current, []);
    expect(result.insights.find((i) => i.id === "sessions-low")).toBeUndefined();
  });

  it("generates focusAlert on decoupling > 5%", () => {
    const current = [
      makeRow({ activityId: "id-am", activityName: "Footing AM", decouplingIndex: 6.5 }),
      makeRow({ activityName: "VMA", decouplingIndex: 2 }),
      makeRow({ activityId: "id-long", activityName: "Long run", decouplingIndex: 8 }),
    ];
    const result = generateInsights(current, []);
    expect(result.focusAlert).not.toBeNull();
    expect(result.focusAlert!.sessions).toHaveLength(2);
    expect(result.focusAlert!.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "id-am", name: "Footing AM" }),
        expect.objectContaining({ id: "id-long", name: "Long run" }),
      ])
    );
    const drift = result.insights.find((i) => i.id === "drift-alert");
    expect(drift).toBeDefined();
    expect(drift!.severity).toBe("alert");
  });

  it("no focusAlert when no decoupling > 5%", () => {
    const current = [makeRow({ decouplingIndex: 4.2 })];
    const result = generateInsights(current, []);
    expect(result.focusAlert).toBeNull();
    expect(result.insights.find((i) => i.id === "drift-alert")).toBeUndefined();
  });
});
