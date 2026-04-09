// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IntervalDetailTable, computeRows, computeSummary } from "./IntervalDetailTable";
import type { ActivityInterval, BlockGroupedIntervals, RepWindow, StreamPoint } from "@/types/activity";

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

function makeInterval(overrides: Partial<ActivityInterval> = {}): ActivityInterval {
  return {
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
    detection_source: "auto",
    respect_score: null,
    ...overrides,
  };
}

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

    expect(document.body.textContent).toContain("P");
    expect(document.body.textContent).toContain("P0");
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

    expect(document.body.textContent).toContain("P");
    expect(document.body.textContent).toContain("P0");
    expect(document.body.textContent).toContain("250 W");
    expect(document.body.textContent).toContain("125 W");
  });

  it("keeps the existing multi-interval drift logic based on the first interval", () => {
    const rows = computeRows(
      [
        makeInterval({ id: "int-1", avg_hr: 150, avg_power: 260, start_time: 0, end_time: 60, duration: 60 }),
        makeInterval({ id: "int-2", avg_hr: 165, avg_power: 255, start_time: 70, end_time: 130, duration: 60 }),
      ],
      true,
      false,
      null
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.driftPercent).toBe(0);
    expect(rows[1]?.driftPercent).toBeCloseTo(10, 5);

    const summary = computeSummary(rows, true);
    expect(summary?.globalDrift).toBeCloseTo(10, 5);
  });

  it("computes mono-interval drift from the first and last 25% of the interval", () => {
    const monoInterval = makeInterval({
      start_time: 0,
      end_time: 100,
      duration: 100,
      avg_hr: 115,
      detection_source: "auto",
    });
    const hrStreams: StreamPoint[] = [
      { t: 0, hr: 100, pwr: 250 },
      { t: 10, hr: 100, pwr: 250 },
      { t: 20, hr: 100, pwr: 250 },
      { t: 40, hr: 110, pwr: 250 },
      { t: 60, hr: 120, pwr: 250 },
      { t: 80, hr: 130, pwr: 250 },
      { t: 90, hr: 130, pwr: 250 },
    ];

    const rows = computeRows([monoInterval], true, false, hrStreams);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.driftPercent).toBeCloseTo(30, 5);

    const summary = computeSummary(rows, true);
    expect(summary?.globalDrift).toBeCloseTo(30, 5);
  });

  it("uses the same mono-interval drift logic for manual intervals", () => {
    const manualInterval = makeInterval({
      detection_source: "manual",
      start_time: 0,
      end_time: 80,
      duration: 80,
      avg_hr: 150,
    });
    const manualStreams: StreamPoint[] = [
      { t: 0, hr: 140, pwr: 240 },
      { t: 10, hr: 140, pwr: 240 },
      { t: 20, hr: 145, pwr: 240 },
      { t: 40, hr: 150, pwr: 240 },
      { t: 60, hr: 168, pwr: 240 },
      { t: 70, hr: 168, pwr: 240 },
    ];

    const rows = computeRows([manualInterval], true, false, manualStreams);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.driftPercent).toBeCloseTo(20, 5);

    const summary = computeSummary(rows, true);
    expect(summary?.globalDrift).toBeCloseTo(20, 5);
  });

  it("falls back to null drift when quarter windows do not have enough HR points", () => {
    const monoInterval = makeInterval({
      start_time: 0,
      end_time: 100,
      duration: 100,
    });
    const sparseStreams: StreamPoint[] = [
      { t: 0, hr: 100, pwr: 250 },
      { t: 50, hr: 115, pwr: 250 },
      { t: 90, hr: 130, pwr: 250 },
    ];

    const rows = computeRows([monoInterval], true, false, sparseStreams);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.driftPercent).toBeNull();

    const summary = computeSummary(rows, true);
    expect(summary?.globalDrift).toBeNull();
  });
});
