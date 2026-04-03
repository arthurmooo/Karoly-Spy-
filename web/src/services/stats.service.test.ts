import { format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsActivityRow } from "@/repositories/stats.repository";
import {
  buildAthleteKpiReport,
  buildPeriodLabel,
  getAthleteKpiFetchRange,
  getCurrentKpiPeriodWindow,
} from "./stats.service";

function makeRow(overrides: Partial<StatsActivityRow> = {}): StatsActivityRow {
  return {
    id: overrides.id ?? "activity-1",
    session_date: overrides.session_date ?? "2026-01-10T09:00:00.000Z",
    sport_type: overrides.sport_type ?? "Run",
    distance_m: overrides.distance_m ?? 10000,
    moving_time_sec: overrides.moving_time_sec ?? 3600,
    duration_sec: overrides.duration_sec ?? 3600,
    load_index: overrides.load_index ?? 80,
    rpe: overrides.rpe ?? 5,
    decoupling_index: overrides.decoupling_index ?? 4,
    durability_index: overrides.durability_index ?? 1,
    avg_hr: overrides.avg_hr ?? 150,
    work_type: overrides.work_type ?? "endurance",
    activity_name: overrides.activity_name ?? "Séance",
    segmented_metrics: overrides.segmented_metrics ?? null,
    hr_zones_sec: overrides.hr_zones_sec ?? null,
  };
}

describe("stats service year period", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a current year window capped at today and a historical full-year window", () => {
    const currentWindow = getCurrentKpiPeriodWindow("year", new Date("2026-04-03T12:00:00.000Z"));
    expect(format(currentWindow.start, "yyyy-MM-dd")).toBe("2026-01-01");
    expect(format(currentWindow.end, "yyyy-MM-dd")).toBe("2026-04-03");

    const historicalWindow = getCurrentKpiPeriodWindow("year", new Date("2025-06-10T12:00:00.000Z"));
    expect(format(historicalWindow.start, "yyyy-MM-dd")).toBe("2025-01-01");
    expect(format(historicalWindow.end, "yyyy-MM-dd")).toBe("2025-12-31");
  });

  it("returns the expected labels and fetch range for year mode", () => {
    expect(buildPeriodLabel("year", new Date("2026-04-03T12:00:00.000Z"))).toBe("Cette année");
    expect(buildPeriodLabel("year", new Date("2025-06-10T12:00:00.000Z"))).toBe("2025");

    const fetchRange = getAthleteKpiFetchRange("year", new Date("2026-04-03T12:00:00.000Z"));
    expect(format(fetchRange.start, "yyyy-MM-dd")).toBe("2019-01-01");
    expect(format(fetchRange.end, "yyyy-MM-dd")).toBe("2026-04-03");
  });

  it("computes year cards and deltas against the previous year", () => {
    const report = buildAthleteKpiReport(
      [
        makeRow({
          id: "current-run",
          session_date: "2026-01-10T09:00:00.000Z",
          sport_type: "Run",
          distance_m: 10000,
          duration_sec: 3600,
          moving_time_sec: 3600,
          rpe: 5,
        }),
        makeRow({
          id: "current-bike",
          session_date: "2026-03-15T09:00:00.000Z",
          sport_type: "Bike",
          distance_m: 20000,
          duration_sec: 7200,
          moving_time_sec: 7200,
          rpe: 7,
        }),
        makeRow({
          id: "previous-run",
          session_date: "2025-02-01T09:00:00.000Z",
          sport_type: "Run",
          distance_m: 5000,
          duration_sec: 1800,
          moving_time_sec: 1800,
          rpe: 4,
        }),
      ],
      "year",
      new Date("2026-04-03T12:00:00.000Z")
    );

    const distance = report.cards.find((card) => card.key === "distance");
    const hours = report.cards.find((card) => card.key === "hours");
    const sessions = report.cards.find((card) => card.key === "sessions");
    const rpe = report.cards.find((card) => card.key === "rpe");

    expect(distance).toEqual(
      expect.objectContaining({
        value: 30,
        displayValue: "30,0 km",
      })
    );
    expect(distance?.deltaPct).toBeCloseTo(500);
    expect(hours?.value).toBe(3);
    expect(hours?.deltaPct).toBeCloseTo(500);
    expect(sessions?.value).toBe(2);
    expect(sessions?.deltaPct).toBeCloseTo(100);
    expect(rpe?.value).toBe(6);
    expect(rpe?.deltaPct).toBeCloseTo(50);
  });
});
