import { describe, expect, it } from "vitest";
import { buildComparisonChartModel, buildComparisonSummary } from "./sessionComparison.service";
import type { Activity, StreamPoint } from "@/types/activity";

function makeStreams(totalDistanceKm: number, secondsPerKm: number, hrStart = 140): StreamPoint[] {
  const speed = 1000 / secondsPerKm;

  return Array.from({ length: totalDistanceKm + 1 }, (_, index) => ({
    t: index * secondsPerKm,
    elapsed_t: index * secondsPerKm,
    dist_m: index * 1000,
    spd: speed,
    hr: hrStart + index,
    alt: index * 4,
  }));
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: overrides.id ?? "activity-1",
    athlete_id: overrides.athlete_id ?? "athlete-1",
    session_date: overrides.session_date ?? "2026-04-01T08:00:00.000Z",
    sport_type: overrides.sport_type ?? "Run",
    work_type: overrides.work_type ?? "endurance",
    activity_name: overrides.activity_name ?? "Tempo",
    duration_sec: overrides.duration_sec ?? 3600,
    moving_time_sec: overrides.moving_time_sec ?? 3600,
    distance_m: overrides.distance_m ?? 10000,
    load_index: overrides.load_index ?? 80,
    avg_hr: overrides.avg_hr ?? 150,
    avg_power: overrides.avg_power ?? null,
    rpe: overrides.rpe ?? 5,
    interval_pace_mean: overrides.interval_pace_mean ?? null,
    interval_pace_last: overrides.interval_pace_last ?? null,
    interval_power_mean: overrides.interval_power_mean ?? null,
    interval_power_last: overrides.interval_power_last ?? null,
    interval_hr_mean: overrides.interval_hr_mean ?? null,
    interval_hr_last: overrides.interval_hr_last ?? null,
    interval_detection_source: overrides.interval_detection_source ?? null,
    decoupling_index: overrides.decoupling_index ?? 3,
    durability_index: overrides.durability_index ?? 1,
    temp_avg: overrides.temp_avg ?? 16,
    elevation_gain: overrides.elevation_gain ?? 60,
    activity_streams: overrides.activity_streams ?? makeStreams(10, 300),
    ...overrides,
  };
}

describe("sessionComparison.service", () => {
  it("builds chart data from manually selected kilometer ranges", () => {
    const current = makeActivity({
      id: "current",
      distance_m: 12000,
      duration_sec: 2880,
      moving_time_sec: 2880,
      activity_streams: makeStreams(12, 240, 142),
    });
    const reference = makeActivity({
      id: "reference",
      session_date: "2026-03-20T08:00:00.000Z",
      distance_m: 14000,
      duration_sec: 4200,
      moving_time_sec: 4200,
      avg_hr: 155,
      activity_streams: makeStreams(14, 300, 145),
    });

    const chartModel = buildComparisonChartModel(
      current,
      reference,
      { startKm: 2, endKm: 12 },
      { startKm: 4, endKm: 14 }
    );

    expect(chartModel).not.toBeNull();
    expect(chartModel!.data[0]).toMatchObject({
      percent: 0,
      currentDistanceM: 2000,
      referenceDistanceM: 4000,
    });
    expect(chartModel!.data[100]).toMatchObject({
      percent: 100,
      currentDistanceM: 12000,
      referenceDistanceM: 14000,
    });
  });

  it("summarizes selected segments instead of whole sessions", () => {
    const current = makeActivity({
      id: "current",
      distance_m: 12000,
      duration_sec: 2880,
      moving_time_sec: 2880,
      avg_hr: 148,
      activity_streams: makeStreams(12, 240, 140),
    });
    const reference = makeActivity({
      id: "reference",
      session_date: "2026-03-20T08:00:00.000Z",
      distance_m: 14000,
      duration_sec: 4200,
      moving_time_sec: 4200,
      avg_hr: 155,
      activity_streams: makeStreams(14, 300, 146),
    });

    const summary = buildComparisonSummary(
      current,
      reference,
      { startKm: 2, endKm: 12 },
      { startKm: 4, endKm: 14 }
    );

    expect(summary.isSegmentComparison).toBe(true);
    expect(summary.currentRangeLabel).toContain("KM 2");
    expect(summary.referenceRangeLabel).toContain("KM 4");
    expect(summary.rows[0]).toMatchObject({
      key: "volume",
      label: "Distance segment",
      currentValue: "10.0 km",
      referenceValue: "10.0 km",
      deltaValue: "0.0 km",
    });
    expect(summary.rows[1]).toMatchObject({
      key: "duration",
      label: "Durée segment",
      currentValue: "40:00",
      referenceValue: "50:00",
      deltaValue: "-10:00",
    });
  });

  it("labels bike power comparisons as power without zeros", () => {
    const current = makeActivity({
      sport_type: "Bike",
      avg_power: 287.5,
      activity_streams: makeStreams(10, 300, 140).map((point) => ({
        ...point,
        pwr: 280,
      })),
    });
    const reference = makeActivity({
      id: "reference",
      sport_type: "Bike",
      avg_power: 270,
      session_date: "2026-03-20T08:00:00.000Z",
      activity_streams: makeStreams(10, 310, 144).map((point) => ({
        ...point,
        pwr: 265,
      })),
    });

    const summary = buildComparisonSummary(current, reference);

    expect(summary.metricLabel).toBe("P");
  });
});
