// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IntervalDetailTable } from "./IntervalDetailTable";
import type { BlockGroupedIntervals, RepWindow, StreamPoint } from "@/types/activity";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const streams: StreamPoint[] = [
  { t: 0, elapsed_t: 0, pwr: 250 },
  { t: 5, elapsed_t: 5, pwr: 0 },
  { t: 10, elapsed_t: 10, pwr: 250 },
  { t: 15, elapsed_t: 15, pwr: 0 },
];

const intervalsByBlock: BlockGroupedIntervals[] = [
  {
    blockIndex: 1,
    label: "Bloc 1",
    intervals: [
      {
        id: "int-1",
        activity_id: "activity-1",
        type: "work",
        start_time: 0,
        end_time: 20,
        duration: 20,
        avg_speed: null,
        avg_power: 250,
        avg_hr: 150,
        avg_cadence: 90,
        detection_source: "manual",
        respect_score: null,
      },
    ],
  },
];

const repWindowsByBlock: Record<number, RepWindow[]> = {
  1: [
    {
      rep_index: 1,
      start_sec: 0,
      end_sec: 20,
      duration_sec: 20,
      hr_raw: 150,
      hr_corr: 148,
      output: 250,
      ea: 0.95,
    },
  ],
};

describe("IntervalDetailTable", () => {
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

  it("shows power without and with zeros in intervals view for bike sessions", async () => {
    await act(async () => {
      root.render(
        <IntervalDetailTable
          intervalsByBlock={intervalsByBlock}
          sportType="Bike"
          repWindowsByBlock={repWindowsByBlock}
          streams={streams}
          expandedBlocks={new Set([1])}
          view="intervals"
          onViewChange={() => undefined}
        />
      );
    });

    expect(document.body.textContent).toContain("P sans 0");
    expect(document.body.textContent).toContain("P avec 0");
    expect(document.body.textContent).toContain("250 W");
    expect(document.body.textContent).toContain("125 W");
  });

  it("shows power without and with zeros in windows view for bike sessions", async () => {
    await act(async () => {
      root.render(
        <IntervalDetailTable
          intervalsByBlock={intervalsByBlock}
          sportType="Bike"
          repWindowsByBlock={repWindowsByBlock}
          streams={streams}
          expandedBlocks={new Set([1])}
          view="windows"
          onViewChange={() => undefined}
        />
      );
    });

    expect(document.body.textContent).toContain("P sans 0");
    expect(document.body.textContent).toContain("P avec 0");
    expect(document.body.textContent).toContain("250 W");
    expect(document.body.textContent).toContain("125 W");
  });
});
