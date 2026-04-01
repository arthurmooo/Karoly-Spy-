import { describe, expect, it } from "vitest";
import { getFormAnalysisHeartRateKpi, isComparableFormAnalysisActivity, selectComparableFormAnalysisActivities } from "./formAnalysisComparable.service";
import type { Activity, FormAnalysisComparableActivity } from "@/types/activity";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-current",
    athlete_id: "athlete-1",
    session_date: "2026-03-20T09:00:00.000Z",
    sport_type: "Run",
    work_type: "endurance",
    activity_name: "Tempo",
    duration_sec: 3600,
    moving_time_sec: 3500,
    distance_m: 10000,
    load_index: 80,
    avg_hr: 152,
    avg_power: null,
    rpe: 5,
    interval_pace_mean: null,
    interval_pace_last: null,
    interval_power_mean: null,
    interval_power_last: null,
    interval_hr_mean: null,
    interval_hr_last: null,
    interval_detection_source: null,
    decoupling_index: 3,
    durability_index: 1,
    temp_avg: 20,
    form_analysis: {
      version: "karo_pdf_2026_03_20b",
      module: "continuous_tempo",
      template_key: "run|tempo|flat",
      comparable_count: 2,
      comparison_mode: "same_temp_bin",
      template: { duration_sec: 1800 },
      temperature: {
        temp: 20,
        temp_bin_width_c: 2,
        hr_mean_raw: 151,
        hr_corr: 151,
      },
      output: {
        mean: 4.5,
        unit: "m/s",
      },
    },
    ...overrides,
  };
}

function makeComparable(overrides: Partial<FormAnalysisComparableActivity> = {}): FormAnalysisComparableActivity {
  return {
    id: "cmp-1",
    athlete_id: "athlete-1",
    session_date: "2026-03-18T09:00:00.000Z",
    sport_type: "Run",
    activity_name: "Tempo ref",
    manual_activity_name: null,
    duration_sec: 3700,
    moving_time_sec: 3600,
    distance_m: 10200,
    avg_hr: 150,
    avg_power: null,
    rpe: 4,
    temp_avg: 20.5,
    form_analysis: {
      version: "karo_pdf_2026_03_20b",
      module: "continuous_tempo",
      template_key: "run|tempo|flat",
      comparison_mode: "same_temp_bin",
      template: { duration_sec: 1820 },
      temperature: {
        temp: 20.5,
        hr_mean_raw: 149,
        hr_corr: 149,
      },
      output: {
        mean: 4.55,
        unit: "m/s",
      },
      decoupling: {
        today: 2.1,
      },
    },
    ...overrides,
  };
}

describe("getFormAnalysisHeartRateKpi", () => {
  it("returns FC corrigée when a real temperature correction is applied", () => {
    const activity = makeActivity({
      form_analysis: {
        ...makeActivity().form_analysis!,
        comparison_mode: "beta_regression",
        temperature: {
          temp: 24,
          beta_hr: 0.7,
          hr_corr: 148,
          delta_hr_corr: -3,
        },
      },
    });

    expect(getFormAnalysisHeartRateKpi(activity.form_analysis)).toMatchObject({
      label: "FC corrigée",
      value: 148,
      delta: -3,
      correctionApplied: true,
    });
  });

  it("returns FC brute when beta regression is unavailable", () => {
    const activity = makeActivity();

    expect(getFormAnalysisHeartRateKpi(activity.form_analysis)).toMatchObject({
      label: "FC brute",
      value: 151,
      delta: null,
      correctionApplied: false,
    });
  });
});

describe("selectComparableFormAnalysisActivities", () => {
  it("filters comparable sessions using backend-equivalent rules", () => {
    const current = makeActivity();
    const included = makeComparable({ id: "included" });
    const excludedTemp = makeComparable({
      id: "excluded-temp",
      form_analysis: {
        ...makeComparable().form_analysis!,
        temperature: { temp: 24.5, hr_mean_raw: 149, hr_corr: 149 },
      },
    });
    const excludedOutput = makeComparable({
      id: "excluded-output",
      form_analysis: {
        ...makeComparable().form_analysis!,
        output: { mean: 5.3, unit: "m/s" },
      },
    });

    expect(isComparableFormAnalysisActivity(current, included)).toBe(true);
    expect(isComparableFormAnalysisActivity(current, excludedTemp)).toBe(false);
    expect(isComparableFormAnalysisActivity(current, excludedOutput)).toBe(false);
  });

  it("limits the final list to comparable_count in backend order", () => {
    const current = makeActivity({
      form_analysis: {
        ...makeActivity().form_analysis!,
        comparable_count: 2,
      },
    });

    const candidates = [
      makeComparable({ id: "older", session_date: "2026-03-10T09:00:00.000Z" }),
      makeComparable({ id: "newest", session_date: "2026-03-19T09:00:00.000Z" }),
      makeComparable({ id: "middle", session_date: "2026-03-15T09:00:00.000Z" }),
    ];

    expect(selectComparableFormAnalysisActivities(current, candidates).map((row) => row.id)).toEqual(["newest", "middle"]);
  });
});
