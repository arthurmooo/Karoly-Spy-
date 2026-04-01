// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormAnalysisPanel } from "./FormAnalysisPanel";
import type { Activity } from "@/types/activity";

const getFormAnalysisComparableActivitiesMock = vi.fn();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/repositories/activity.repository", () => ({
  getFormAnalysisComparableActivities: (...args: unknown[]) => getFormAnalysisComparableActivitiesMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: "coach" }),
}));

function makeActivity(): Activity {
  return {
    id: "activity-current",
    athlete_id: "athlete-1",
    session_date: "2026-03-20T09:00:00.000Z",
    sport_type: "Run",
    work_type: "endurance",
    activity_name: "Tempo current",
    duration_sec: 3600,
    moving_time_sec: 3500,
    distance_m: 10000,
    load_index: 90,
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
      comparable_count: 1,
      comparison_mode: "same_temp_bin",
      template: { duration_sec: 1800 },
      temperature: {
        temp: 20,
        hr_mean_raw: 151,
        hr_corr: 151,
        temp_bin_width_c: 2,
      },
      output: {
        mean: 4.5,
        unit: "m/s",
      },
      decoupling: {
        metric: "dec_pct",
        today: 2.5,
        delta: 0.2,
      },
      rpe: {
        today: 5,
        delta: 0,
      },
      ea: {
        today: 0.03,
        delta_pct: 1.2,
      },
      decision: {
        final: "stable",
        reasons: [],
      },
    },
  };
}

describe("FormAnalysisPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    getFormAnalysisComparableActivitiesMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("opens the comparable sessions dialog when the badge is clicked", async () => {
    getFormAnalysisComparableActivitiesMock.mockResolvedValue([
      {
        id: "cmp-1",
        athlete_id: "athlete-1",
        session_date: "2026-03-18T09:00:00.000Z",
        sport_type: "Run",
        activity_name: "Tempo ref",
        manual_activity_name: null,
        duration_sec: 3600,
        moving_time_sec: 3500,
        distance_m: 10100,
        avg_hr: 150,
        avg_power: null,
        rpe: 4,
        temp_avg: 20.5,
        form_analysis: {
          version: "karo_pdf_2026_03_20b",
          module: "continuous_tempo",
          template_key: "run|tempo|flat",
          comparison_mode: "same_temp_bin",
          template: { duration_sec: 1790 },
          temperature: { temp: 20.5, hr_mean_raw: 149, hr_corr: 149 },
          output: { mean: 4.55, unit: "m/s" },
          decoupling: { today: 2.1 },
        },
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <FormAnalysisPanel activity={makeActivity()} formAnalysis={makeActivity().form_analysis!} />
        </MemoryRouter>
      );
    });

    const trigger = Array.from(document.querySelectorAll("button")).find((node) => node.textContent?.includes("1 séances"));
    expect(trigger?.textContent).toContain("1 séances");

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Séances comparables");
    expect(document.body.textContent).toContain("Tempo ref");
  });
});
