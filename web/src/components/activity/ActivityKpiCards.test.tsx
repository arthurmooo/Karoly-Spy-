// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActivityKpiCards } from "./ActivityKpiCards";
import type { Activity } from "@/types/activity";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    athlete_id: "athlete-1",
    session_date: "2026-04-05T08:04:19.000Z",
    sport_type: "Bike",
    work_type: "endurance",
    activity_name: "ENC Tempo Full Vélo - 45Km Tempo",
    duration_sec: 7067,
    moving_time_sec: 7067,
    distance_m: 72478,
    load_index: 90,
    avg_hr: 140,
    avg_power: 287.5,
    rpe: 6,
    interval_pace_mean: null,
    interval_pace_last: null,
    interval_power_mean: null,
    interval_power_last: null,
    interval_hr_mean: null,
    interval_hr_last: null,
    interval_detection_source: null,
    decoupling_index: 3,
    durability_index: 1,
    source_json: { avg_watt: "270.0", np: "288.0" },
    ...overrides,
  };
}

describe("ActivityKpiCards", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("shows both bike power values with explicit labels", async () => {
    await act(async () => {
      root.render(<ActivityKpiCards activity={makeActivity()} />);
    });

    expect(document.body.textContent).toContain("P");
    expect(document.body.textContent).toContain("288 W");
    expect(document.body.textContent).toContain("P0");
    expect(document.body.textContent).toContain("270 W");
  });

  it("shows -- for power with zeros when avg_watt is missing", async () => {
    await act(async () => {
      root.render(
        <ActivityKpiCards
          activity={makeActivity({
            source_json: {},
          })}
        />
      );
    });

    expect(document.body.textContent).toContain("P0");
    expect(document.body.textContent).toContain("--");
  });

  it("keeps single pace display for non-bike sports", async () => {
    await act(async () => {
      root.render(
        <ActivityKpiCards
          activity={makeActivity({
            sport_type: "Run",
            avg_power: null,
            distance_m: 10000,
            duration_sec: 3000,
            moving_time_sec: 3000,
            source_json: null,
          })}
        />
      );
    });

    expect(document.body.textContent).toContain("Allure Moy");
    expect(document.body.textContent).not.toContain("P0");
  });
});
