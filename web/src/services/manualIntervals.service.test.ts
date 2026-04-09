import { describe, expect, it } from "vitest";

import {
  buildManualBlockPayload,
  detectBestSegments,
  getExcludedSegmentsForBlock,
  type DetectedSegment,
} from "./manualIntervals.service";
import type { Activity, StreamPoint } from "@/types/activity";

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

function makeStreamsFromSpeeds(speeds: number[], stepSec = 1): StreamPoint[] {
  return speeds.map((spd, index) => ({
    t: index * stepSec,
    spd,
    hr: 140 + index,
  }));
}

describe("detectBestSegments", () => {
  it("ignores candidates that overlap excluded ranges while allowing touching boundaries", () => {
    const streams = makeStreamsFromSpeeds([9, 9, 9, 8, 8, 8], 1);

    const detected = detectBestSegments({
      streams,
      mode: "duration",
      metric: "speed",
      repetitions: 1,
      targetDurationSec: 3,
      excludedSegments: [{ startSec: 0, endSec: 3 }],
    });

    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({
      startSec: 3,
      endSec: 6,
      avgSpeed: 8,
    });
  });

  it("keeps the historical behavior when no excluded range is provided", () => {
    const streams = makeStreamsFromSpeeds([4, 6, 5, 1], 1);

    const withoutExcludedSegments = detectBestSegments({
      streams,
      mode: "duration",
      metric: "speed",
      repetitions: 1,
      targetDurationSec: 2,
    });
    const withEmptyExcludedSegments = detectBestSegments({
      streams,
      mode: "duration",
      metric: "speed",
      repetitions: 1,
      targetDurationSec: 2,
      excludedSegments: [],
    });

    expect(withEmptyExcludedSegments).toEqual(withoutExcludedSegments);
    expect(withoutExcludedSegments[0]).toMatchObject({
      startSec: 1,
      endSec: 3,
    });
  });

  it("prevents the long block from reusing the fast 3 km already assigned to the other block", () => {
    const streams = makeStreamsFromSpeeds(
      [...Array(25).fill(1000), ...Array(3).fill(1100)],
      1
    );

    const fastBlock = detectBestSegments({
      streams,
      mode: "distance",
      metric: "speed",
      repetitions: 1,
      targetDistanceM: 3000,
    });
    const longBlockWithoutExclusion = detectBestSegments({
      streams,
      mode: "distance",
      metric: "speed",
      repetitions: 1,
      targetDistanceM: 25000,
    });
    const longBlockWithExclusion = detectBestSegments({
      streams,
      mode: "distance",
      metric: "speed",
      repetitions: 1,
      targetDistanceM: 25000,
      excludedSegments: fastBlock.map((segment) => ({
        startSec: segment.startSec,
        endSec: segment.endSec,
      })),
    });

    expect(fastBlock).toHaveLength(1);
    expect(fastBlock[0]!.startSec).toBeCloseTo(25, 5);

    expect(longBlockWithoutExclusion).toHaveLength(1);
    expect(longBlockWithoutExclusion[0]!.startSec).toBeGreaterThan(0);
    expect(longBlockWithoutExclusion[0]!.endSec).toBeGreaterThan(fastBlock[0]!.startSec);

    expect(longBlockWithExclusion).toHaveLength(1);
    expect(longBlockWithExclusion[0]!.startSec).toBeCloseTo(0, 5);
    expect(longBlockWithExclusion[0]!.endSec).toBeLessThanOrEqual(fastBlock[0]!.startSec);
  });
});

describe("getExcludedSegmentsForBlock", () => {
  it("returns only the segments from the opposite manual block", () => {
    const manualBlocks: NonNullable<Activity["manual_interval_segments"]> = [
      {
        block_index: 1,
        segments: [
          { start_sec: 10, end_sec: 20, duration_sec: 10, distance_m: 1000, avg_speed: 5, avg_power: null, avg_hr: 150 },
        ],
      },
      {
        block_index: 2,
        segments: [
          { start_sec: 40, end_sec: 50, duration_sec: 10, distance_m: 1000, avg_speed: 6, avg_power: null, avg_hr: 160 },
        ],
      },
    ];

    expect(getExcludedSegmentsForBlock(manualBlocks, 1)).toEqual([{ startSec: 40, endSec: 50 }]);
    expect(getExcludedSegmentsForBlock(manualBlocks, 2)).toEqual([{ startSec: 10, endSec: 20 }]);
  });
});

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
