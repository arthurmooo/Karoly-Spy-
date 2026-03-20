import { describe, expect, it } from "vitest";
import type { DailyLoadHistoryRow } from "@/repositories/load.repository";
import { buildWeeklyHeatmapData } from "./load.service";

function makeRow(
  id: string,
  date: string,
  loadIndex: number,
  durationSec: number
): DailyLoadHistoryRow {
  return {
    id,
    session_date: `${date}T12:00:00Z`,
    load_index: loadIndex,
    duration_sec: durationSec,
  };
}

describe("buildWeeklyHeatmapData", () => {
  it("builds exactly seven days from monday to sunday", () => {
    const result = buildWeeklyHeatmapData([], "2026-03-18");

    expect(result.weekStart).toBe("2026-03-16");
    expect(result.weekEnd).toBe("2026-03-22");
    expect(result.days).toHaveLength(7);
    expect(result.days.map((day) => day.label)).toEqual([
      "Lun",
      "Mar",
      "Mer",
      "Jeu",
      "Ven",
      "Sam",
      "Dim",
    ]);
    expect(result.days[0]?.date).toBe("2026-03-16");
    expect(result.days[6]?.date).toBe("2026-03-22");
  });

  it("aggregates multiple sessions on the same day", () => {
    const rows = [
      makeRow("a", "2026-03-17", 120, 3600),
      makeRow("b", "2026-03-17", 80, 1800),
      makeRow("c", "2026-03-18", 60, 2400),
    ];

    const result = buildWeeklyHeatmapData(rows, "2026-03-18");
    const tuesday = result.days.find((day) => day.date === "2026-03-17");

    expect(tuesday).toMatchObject({
      mls: 200,
      durationSec: 5400,
      sessionCount: 2,
    });
  });

  it("fills missing days with zero load", () => {
    const result = buildWeeklyHeatmapData(
      [makeRow("a", "2026-03-18", 90, 2700)],
      "2026-03-18"
    );
    const monday = result.days.find((day) => day.date === "2026-03-16");

    expect(monday).toMatchObject({
      mls: 0,
      durationSec: 0,
      sessionCount: 0,
      level: "rest",
    });
  });

  it("computes thresholds from the athlete history window", () => {
    const rows = [
      makeRow("a", "2026-01-26", 100, 1800),
      makeRow("b", "2026-02-09", 200, 1800),
      makeRow("c", "2026-02-23", 300, 1800),
      makeRow("d", "2026-03-09", 400, 1800),
    ];

    const result = buildWeeklyHeatmapData(rows, "2026-03-18");

    expect(result.thresholds.p25).toBeCloseTo(175);
    expect(result.thresholds.p50).toBeCloseTo(250);
    expect(result.thresholds.p75).toBeCloseTo(325);
  });

  it("keeps zero-load days as rest regardless of thresholds", () => {
    const rows = [
      makeRow("a", "2026-03-16", 150, 1800),
      makeRow("b", "2026-03-18", 450, 1800),
    ];

    const result = buildWeeklyHeatmapData(rows, "2026-03-18");
    const thursday = result.days.find((day) => day.date === "2026-03-19");

    expect(thursday?.level).toBe("rest");
  });

  it("stays stable with sparse history", () => {
    const rows = [makeRow("a", "2026-03-18", 420, 3600)];
    const result = buildWeeklyHeatmapData(rows, "2026-03-18");
    const wednesday = result.days.find((day) => day.date === "2026-03-18");

    expect(result.thresholds).toEqual({
      p25: 420,
      p50: 420,
      p75: 420,
    });
    expect(wednesday?.level).toBe("low");
  });
});
