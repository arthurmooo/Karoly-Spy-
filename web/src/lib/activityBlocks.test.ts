import { describe, expect, it } from "vitest";

import {
  buildResolvedBlocks,
  computeBlockGroupedIntervals,
  computeEffectiveIntervals,
  mapPersistedManualSegments,
} from "./activityBlocks";
import type { Activity, ActivityInterval } from "@/types/activity";

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
    manual_interval_block_1_count: 2,
    manual_interval_block_1_duration_sec: 100,
    manual_interval_block_1_pace_mean: 3.4,
    manual_interval_block_1_pace_last: 3.5,
    manual_interval_block_1_hr_mean: 166,
    manual_interval_block_1_hr_last: 168,
    manual_interval_segments: [
      {
        block_index: 1,
        segments: [
          { start_sec: 100, end_sec: 200, duration_sec: 100, distance_m: 500, avg_speed: 5, avg_power: null, avg_hr: 165 },
          { start_sec: 250, end_sec: 350, duration_sec: 100, distance_m: 500, avg_speed: 5.1, avg_power: null, avg_hr: 167 },
        ],
      },
    ],
    interval_detection_source: "manual",
    decoupling_index: 2,
    durability_index: 0.9,
    segmented_metrics: {
      interval_blocks: [
        {
          block_index: 1,
          count: 2,
          interval_hr_last: 168,
          interval_hr_mean: 166,
          interval_pace_last: 3.5,
          interval_pace_mean: 3.4,
          interval_pahr_last: null,
          interval_pahr_mean: null,
          interval_power_last: null,
          interval_power_mean: null,
          interval_respect_score_mean: null,
          representative_distance_m: 500,
          representative_duration_sec: 100,
          total_duration_sec: 200,
        },
        {
          block_index: 2,
          count: 2,
          interval_hr_last: 172,
          interval_hr_mean: 170,
          interval_pace_last: 3.7,
          interval_pace_mean: 3.6,
          interval_pahr_last: null,
          interval_pahr_mean: null,
          interval_power_last: null,
          interval_power_mean: null,
          interval_respect_score_mean: null,
          representative_distance_m: 500,
          representative_duration_sec: 100,
          total_duration_sec: 200,
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

const dbIntervals: ActivityInterval[] = [
  {
    id: "auto-1",
    activity_id: "activity-1",
    type: "active",
    start_time: 50,
    end_time: 150,
    duration: 100,
    avg_speed: 4.8,
    avg_power: null,
    avg_hr: 160,
    avg_cadence: null,
    detection_source: "lap",
    respect_score: null,
  },
  {
    id: "auto-2",
    activity_id: "activity-1",
    type: "active",
    start_time: 200,
    end_time: 300,
    duration: 100,
    avg_speed: 4.9,
    avg_power: null,
    avg_hr: 162,
    avg_cadence: null,
    detection_source: "lap",
    respect_score: null,
  },
  {
    id: "auto-3",
    activity_id: "activity-1",
    type: "active",
    start_time: 400,
    end_time: 500,
    duration: 100,
    avg_speed: 5.0,
    avg_power: null,
    avg_hr: 168,
    avg_cadence: null,
    detection_source: "lap",
    respect_score: null,
  },
];

describe("manual interval canonicalization helpers", () => {
  it("replaces auto intervals entirely when persisted manual segments exist", () => {
    const activity = makeActivity();
    const manualSegs = mapPersistedManualSegments(activity.manual_interval_segments);

    const effective = computeEffectiveIntervals(dbIntervals, manualSegs, activity.id);
    const byBlock = computeBlockGroupedIntervals(
      dbIntervals,
      manualSegs,
      activity.segmented_metrics?.interval_blocks,
      activity.id,
      activity
    );
    const resolvedBlocks = buildResolvedBlocks(
      activity,
      activity.segmented_metrics?.interval_blocks,
      dbIntervals,
      manualSegs,
      null
    );

    expect(effective).toHaveLength(2);
    expect(effective.every((interval) => interval.detection_source === "manual")).toBe(true);
    expect(byBlock).toHaveLength(1);
    expect(byBlock[0]?.intervals).toHaveLength(2);
    expect(resolvedBlocks).toHaveLength(1);
    expect(resolvedBlocks[0]?.rows.every((row) => row.origin === "manual")).toBe(true);
  });
});
