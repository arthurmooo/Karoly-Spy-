import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };

const mockState = vi.hoisted(() => ({
  activityResults: [] as QueryResult[],
  intervalResult: { data: [], error: null } as QueryResult,
  activitySelects: [] as string[],
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    if (table === "activities") {
      return {
        select: vi.fn((columns: string) => {
          mockState.activitySelects.push(columns);
          return {
            eq: vi.fn(() => ({
              single: vi.fn(async () => {
                const next = mockState.activityResults.shift();
                if (!next) {
                  throw new Error("No mocked activities response available");
                }
                return next;
              }),
            })),
          };
        }),
      };
    }

    if (table === "activity_intervals") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => mockState.intervalResult),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

import { getActivityDetail } from "./activity.repository";

function makeActivityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "activity-1",
    athlete_id: "athlete-1",
    session_date: "2026-03-18T09:00:00.000Z",
    sport_type: "Run",
    work_type: "intervals",
    activity_name: "8x400",
    manual_activity_name: null,
    duration_sec: 3600,
    moving_time_sec: 3500,
    distance_m: 10000,
    load_index: 90,
    avg_hr: 156,
    avg_power: null,
    rpe: 7,
    fit_file_path: "path.fit",
    interval_pace_mean: null,
    interval_pace_last: null,
    interval_power_mean: null,
    interval_power_last: null,
    interval_hr_mean: 160,
    interval_hr_last: 166,
    manual_interval_pace_mean: null,
    manual_interval_pace_last: null,
    manual_interval_power_mean: null,
    manual_interval_power_last: null,
    manual_interval_hr_mean: null,
    manual_interval_hr_last: null,
    manual_interval_block_1_power_mean: null,
    manual_interval_block_1_power_last: null,
    manual_interval_block_1_hr_mean: null,
    manual_interval_block_1_hr_last: null,
    manual_interval_block_1_pace_mean: null,
    manual_interval_block_1_pace_last: null,
    manual_interval_block_2_power_mean: null,
    manual_interval_block_2_power_last: null,
    manual_interval_block_2_hr_mean: null,
    manual_interval_block_2_hr_last: null,
    manual_interval_block_2_pace_mean: null,
    manual_interval_block_2_pace_last: null,
    manual_interval_block_1_count: null,
    manual_interval_block_1_duration_sec: null,
    manual_interval_block_2_count: null,
    manual_interval_block_2_duration_sec: null,
    manual_interval_segments: null,
    interval_detection_source: "auto",
    decoupling_index: 3,
    durability_index: 0.92,
    source_json: null,
    segmented_metrics: null,
    coach_comment: null,
    athlete_comment: null,
    athletes: [{ first_name: "Arthur", last_name: "Mo" }],
    ...overrides,
  };
}

function missingColumn(message: string): QueryResult {
  return {
    data: null,
    error: { code: "42703", message },
  };
}

beforeEach(() => {
  mockState.activityResults = [];
  mockState.intervalResult = { data: [{ id: "interval-1", activity_id: "activity-1" }], error: null };
  mockState.activitySelects = [];
  supabaseMock.from.mockClear();
});

describe("getActivityDetail", () => {
  it("uses the full query when the latest schema is available", async () => {
    mockState.activityResults = [
      {
        data: makeActivityRow({
          analysis_dirty: true,
          manual_work_type: "intervals",
          detected_work_type: "intervals",
          athlete_feedback_rating: 4,
          athlete_feedback_text: "RAS",
          form_analysis: { rep_windows: [{ rep_index: 1, hr_raw: 158 }] },
          activity_streams: [{ t: 0, hr: 140 }],
          garmin_laps: [{ lap_n: 1, start_sec: 0, duration_sec: 60, distance_m: 300 }],
        }),
        error: null,
      },
    ];

    const result = await getActivityDetail("activity-1");

    expect(mockState.activitySelects).toHaveLength(1);
    expect(mockState.activitySelects[0]).toContain("form_analysis");
    expect(mockState.activitySelects[0]).toContain("activity_streams");
    expect(result.activity.form_analysis?.rep_windows).toEqual([{ rep_index: 1, hr_raw: 158 }]);
    expect(result.activity.analysis_dirty).toBe(true);
    expect(result.activity.athletes).toEqual({ first_name: "Arthur", last_name: "Mo" });
  });

  it("falls back without streams/laps while keeping form_analysis", async () => {
    mockState.activityResults = [
      missingColumn('column "activity_streams" does not exist'),
      {
        data: makeActivityRow({
          form_analysis: { rep_windows: [{ rep_index: 2, hr_raw: 162 }] },
          athletes: { first_name: "Arthur", last_name: "Mo" },
        }),
        error: null,
      },
    ];

    const result = await getActivityDetail("activity-1");

    expect(mockState.activitySelects).toHaveLength(2);
    expect(mockState.activitySelects[1]).not.toContain("activity_streams");
    expect(mockState.activitySelects[1]).not.toContain("garmin_laps");
    expect(mockState.activitySelects[1]).toContain("form_analysis");
    expect(result.activity.form_analysis?.rep_windows).toEqual([{ rep_index: 2, hr_raw: 162 }]);
  });

  it("falls back past feedback and work-type override columns while keeping form_analysis", async () => {
    mockState.activityResults = [
      missingColumn('column "activity_streams" does not exist'),
      missingColumn('column "athlete_feedback_rating" does not exist'),
      missingColumn('column "manual_work_type" does not exist'),
      {
        data: makeActivityRow({
          form_analysis: { rep_windows: [{ rep_index: 3, hr_raw: 165 }] },
        }),
        error: null,
      },
    ];

    const result = await getActivityDetail("activity-1");

    expect(mockState.activitySelects).toHaveLength(4);
    expect(mockState.activitySelects[2]).not.toContain("athlete_feedback_rating");
    expect(mockState.activitySelects[2]).toContain("form_analysis");
    expect(mockState.activitySelects[3]).not.toContain("manual_work_type");
    expect(mockState.activitySelects[3]).not.toContain("analysis_dirty");
    expect(mockState.activitySelects[3]).toContain("form_analysis");
    expect(result.activity.form_analysis?.rep_windows).toEqual([{ rep_index: 3, hr_raw: 165 }]);
    expect(result.activity.analysis_dirty).toBe(false);
  });

  it("falls back to the oldest compatible query when form_analysis is unavailable", async () => {
    mockState.activityResults = [
      missingColumn('column "activity_streams" does not exist'),
      missingColumn('column "athlete_feedback_rating" does not exist'),
      missingColumn('column "manual_work_type" does not exist'),
      missingColumn('column "form_analysis" does not exist'),
      {
        data: makeActivityRow(),
        error: null,
      },
    ];

    const result = await getActivityDetail("activity-1");

    expect(mockState.activitySelects).toHaveLength(5);
    expect(mockState.activitySelects[4]).not.toContain("form_analysis");
    expect(result.activity.form_analysis).toBeUndefined();
    expect(result.intervals).toEqual([{ id: "interval-1", activity_id: "activity-1" }]);
  });
});
