import { describe, expect, it } from "vitest";

import { buildManualBlockPayload, type DetectedSegment } from "./manualIntervals.service";
import type { Activity } from "@/types/activity";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    athlete_id: "athlete-1",
    session_date: "2026-03-25T09:00:00.000Z",
    sport_type: "Run",
    work_type: "intervals",
    activity_name: "20x500m",
    duration_sec: 3600,
    moving_time_sec: 3500,
    distance_m: 15000,
    load_index: 90,
    avg_hr: 150,
    avg_power: null,
    rpe: 7,
    interval_pace_mean: 3.5,
    interval_pace_last: 3.6,
    interval_power_mean: null,
    interval_power_last: null,
    interval_hr_mean: 165,
    interval_hr_last: 170,
    interval_detection_source: "lap",
    decoupling_index: 2,
    durability_index: 0.9,
    manual_interval_segments: null,
    segmented_metrics: {
      interval_blocks: [
        {
          block_index: 1,
          count: 3,
          interval_hr_last: 168,
          interval_hr_mean: 164,
          interval_pace_last: 3.5,
          interval_pace_mean: 3.45,
          interval_pahr_last: null,
          interval_pahr_mean: null,
          interval_power_last: null,
          interval_power_mean: null,
          interval_respect_score_mean: null,
          representative_distance_m: 500,
          representative_duration_sec: 105,
          total_duration_sec: 315,
        },
      ],
    },
    form_analysis: null,
    activity_streams: null,
    garmin_laps: null,
    athletes: null,
    ...overrides,
  };
}

function makeSegment(startSec: number, endSec: number, avgHr: number): DetectedSegment {
  return {
    id: `${startSec}-${endSec}`,
    startSec,
    endSec,
    durationSec: endSec - startSec,
    distanceM: 500,
    avgValue: 5,
    avgHr,
    avgSpeed: 5,
    avgPower: null,
  };
}

describe("buildManualBlockPayload", () => {
  it("persists the injected segments as canonical manual interval blocks", () => {
    const activity = makeActivity();

    const payload = buildManualBlockPayload(activity, 1, [
      makeSegment(100, 205, 164),
      makeSegment(250, 355, 166),
      makeSegment(400, 505, 168),
    ]);

    expect(payload.reset_to_auto).toBe(false);
    expect(payload.manual_interval_segments).toEqual([
      {
        block_index: 1,
        segments: [
          expect.objectContaining({ start_sec: 100, end_sec: 205, avg_hr: 164 }),
          expect.objectContaining({ start_sec: 250, end_sec: 355, avg_hr: 166 }),
          expect.objectContaining({ start_sec: 400, end_sec: 505, avg_hr: 168 }),
        ],
      },
    ]);
    expect(payload.overrides.manual_interval_block_1_count).toBe(3);
  });

  it("removes only the reset block and requests full auto restore when none remain", () => {
    const activity = makeActivity({
      manual_interval_block_1_count: 2,
      manual_interval_block_1_duration_sec: 105,
      manual_interval_segments: [
        {
          block_index: 1,
          segments: [
            { start_sec: 100, end_sec: 205, duration_sec: 105, distance_m: 500, avg_speed: 5, avg_power: null, avg_hr: 164 },
            { start_sec: 250, end_sec: 355, duration_sec: 105, distance_m: 500, avg_speed: 5, avg_power: null, avg_hr: 166 },
          ],
        },
      ],
    });

    const payload = buildManualBlockPayload(activity, 1, null);

    expect(payload.manual_interval_segments).toEqual([]);
    expect(payload.reset_to_auto).toBe(true);
    expect(payload.overrides.manual_interval_block_1_count).toBeNull();
  });
});
