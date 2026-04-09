import { describe, expect, it } from "vitest";
import { mergeActivityDetailState } from "./useActivityDetail";
import type { Activity } from "@/types/activity";

function buildBikeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    athlete_id: "athlete-1",
    session_date: "2026-04-09T10:04:37.000Z",
    sport_type: "BIKE",
    work_type: "endurance",
    activity_name: "Séance vélo",
    duration_sec: 3600,
    moving_time_sec: 3500,
    distance_m: 40000,
    load_index: null,
    avg_hr: null,
    avg_power: 220,
    rpe: null,
    interval_pace_mean: null,
    interval_pace_last: null,
    interval_power_mean: null,
    interval_power_last: null,
    interval_hr_mean: null,
    interval_hr_last: null,
    interval_detection_source: null,
    decoupling_index: null,
    durability_index: null,
    ...overrides,
  };
}

describe("useActivityDetail mergeActivityDetailState", () => {
  it("preserves richer bike laps when a refresh returns stale laps", () => {
    const prev = buildBikeActivity({
      garmin_laps: [
        { lap_n: 1, start_sec: 0, duration_sec: 600, distance_m: 5000, avg_power: 250, avg_power_with_zeros: 230 },
      ],
    });

    const next = buildBikeActivity({
      garmin_laps: [{ lap_n: 1, start_sec: 0, duration_sec: 600, distance_m: 5000, avg_power: 250 }],
    });

    const merged = mergeActivityDetailState(prev, next);

    expect(merged.garmin_laps?.[0]?.avg_power_with_zeros).toBe(230);
  });

  it("keeps richer streams when a refresh returns incomplete mappings", () => {
    const prev = buildBikeActivity({
      activity_streams: [{ t: 0, elapsed_t: 0, dist_m: 0, pwr: 180 }],
    });

    const next = buildBikeActivity({
      activity_streams: [{ t: 0, pwr: 180 }],
    });

    const merged = mergeActivityDetailState(prev, next);

    expect(merged.activity_streams?.[0]?.elapsed_t).toBe(0);
    expect(merged.activity_streams?.[0]?.dist_m).toBe(0);
  });

  it("accepts complete refreshed laps when they are fully populated", () => {
    const prev = buildBikeActivity({
      garmin_laps: [{ lap_n: 1, start_sec: 0, duration_sec: 600, distance_m: 5000, avg_power: 250 }],
    });

    const next = buildBikeActivity({
      garmin_laps: [
        { lap_n: 1, start_sec: 0, duration_sec: 600, distance_m: 5000, avg_power: 250, avg_power_with_zeros: 230 },
      ],
    });

    const merged = mergeActivityDetailState(prev, next);

    expect(merged.garmin_laps?.[0]?.avg_power_with_zeros).toBe(230);
  });
});
