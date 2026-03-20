import { describe, expect, it } from "vitest";
import { buildAthleteKpiReport, type KpiPeriod } from "@/services/stats.service";
import type { StatsActivityRow } from "@/repositories/stats.repository";

function makeRow(overrides: Partial<StatsActivityRow>): StatsActivityRow {
  return {
    session_date: "2026-03-18T09:00:00.000Z",
    sport_type: "Run",
    distance_m: 10000,
    moving_time_sec: 3600,
    duration_sec: 3900,
    load_index: 100,
    rpe: 5,
    decoupling_index: 3,
    ...overrides,
  };
}

function buildReport(rows: StatsActivityRow[], period: KpiPeriod, nowIso: string) {
  return buildAthleteKpiReport(rows, period, new Date(nowIso));
}

describe("buildAthleteKpiReport", () => {
  it("uses Monday-based week windows across a boundary", () => {
    const report = buildReport(
      [
        makeRow({ session_date: "2026-03-16T10:00:00.000Z", distance_m: 8000, moving_time_sec: 2400, load_index: 80 }),
        makeRow({ session_date: "2026-03-09T10:00:00.000Z", distance_m: 4000, moving_time_sec: 1200, load_index: 40 }),
      ],
      "week",
      "2026-03-18T12:00:00.000Z"
    );

    expect(report.cards.find((card) => card.key === "distance")?.displayValue).toBe("8,0 km");
    expect(report.cards.find((card) => card.key === "distance")?.deltaDisplay).toBe("+100,0 %");
  });

  it("compares month-to-date against previous month-to-date", () => {
    const report = buildReport(
      [
        makeRow({ session_date: "2026-03-10T10:00:00.000Z", distance_m: 15000, moving_time_sec: 3600, load_index: 120 }),
        makeRow({ session_date: "2026-02-10T10:00:00.000Z", distance_m: 10000, moving_time_sec: 3600, load_index: 90 }),
        makeRow({ session_date: "2026-02-26T10:00:00.000Z", distance_m: 99999, moving_time_sec: 9999, load_index: 999 }),
      ],
      "month",
      "2026-03-18T12:00:00.000Z"
    );

    expect(report.cards.find((card) => card.key === "distance")?.displayValue).toBe("15,0 km");
    expect(report.cards.find((card) => card.key === "distance")?.deltaDisplay).toBe("+50,0 %");
  });

  it("falls back to duration_sec when moving_time_sec is null", () => {
    const report = buildReport(
      [makeRow({ moving_time_sec: null, duration_sec: 5400 })],
      "week",
      "2026-03-18T12:00:00.000Z"
    );

    expect(report.cards.find((card) => card.key === "hours")?.displayValue).toBe("1,5 h");
  });

  it("groups minor sports into Autres and ignores missing distance", () => {
    const report = buildReport(
      [
        makeRow({ sport_type: "Run", moving_time_sec: 3600 }),
        makeRow({ sport_type: "Bike", moving_time_sec: 3000, distance_m: null }),
        makeRow({ sport_type: "Swim", moving_time_sec: 1800, distance_m: null }),
        makeRow({ sport_type: "Ski", moving_time_sec: 1200, distance_m: null }),
        makeRow({ sport_type: "Strength", moving_time_sec: 900, distance_m: null }),
      ],
      "week",
      "2026-03-18T12:00:00.000Z"
    );

    expect(report.distribution).toHaveLength(4);
    expect(report.distribution[3]?.label).toBe("Autres");
    expect(report.cards.find((card) => card.key === "distance")?.displayValue).toBe("10,0 km");
  });

  it("ignores null RPE and decoupling values", () => {
    const report = buildReport(
      [
        makeRow({ rpe: null, decoupling_index: null }),
        makeRow({ rpe: 6, decoupling_index: 4 }),
      ],
      "week",
      "2026-03-18T12:00:00.000Z"
    );

    expect(report.cards.find((card) => card.key === "rpe")?.displayValue).toBe("6,0");
    expect(report.cards.find((card) => card.key === "decoupling")?.displayValue).toBe("4,0 %");
  });

  it("returns an empty-state friendly report when there is no activity", () => {
    const report = buildReport([], "week", "2026-03-18T12:00:00.000Z");

    expect(report.cards.find((card) => card.key === "distance")?.displayValue).toBe("0,0 km");
    expect(report.cards.find((card) => card.key === "rpe")?.displayValue).toBe("--");
    expect(report.distribution).toEqual([]);
    expect(report.sportDecoupling).toEqual([]);
    expect(report.weeklyLoad).toHaveLength(8);
  });
});
