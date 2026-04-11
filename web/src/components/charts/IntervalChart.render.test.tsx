// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntervalChart } from "./IntervalChart";
import type { BlockGroupedIntervals, RepWindow } from "@/types/activity";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const NullComponent = () => null;

  return {
    ResponsiveContainer: Passthrough,
    ComposedChart: Passthrough,
    CartesianGrid: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    Tooltip: NullComponent,
    ReferenceLine: NullComponent,
    Line: NullComponent,
  };
});

vi.mock("@/hooks/useChartTheme", () => ({
  useChartTheme: () => ({
    grid: "#e2e8f0",
    tick: "#64748b",
    tooltipStyle: {},
    activeDotFill: "#ffffff",
  }),
}));

const intervalsByBlock: BlockGroupedIntervals[] = [
  {
    blockIndex: 1,
    label: "Bloc tempo",
    intervals: [
      {
        id: "tempo-1",
        activity_id: "activity-1",
        type: "work",
        start_time: 0,
        end_time: 300,
        duration: 300,
        avg_speed: 4.5,
        avg_power: null,
        avg_hr: 162,
        avg_cadence: null,
        detection_source: "manual",
        respect_score: null,
      },
    ],
  },
];

const emptyWindowsByBlock: Record<number, RepWindow[]> = {
  1: [],
};

describe("IntervalChart", () => {
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

  it("keeps a stable hook order when switching from intervals to empty windows", async () => {
    await act(async () => {
      root.render(
        <IntervalChart
          intervalsByBlock={intervalsByBlock}
          repWindowsByBlock={emptyWindowsByBlock}
          streams={null}
          viewMode="intervals"
          physioProfile={null}
          sportType="Run"
        />
      );
    });

    expect(container.textContent).toContain("Évolution par intervalle");

    await act(async () => {
      root.render(
        <IntervalChart
          intervalsByBlock={intervalsByBlock}
          repWindowsByBlock={emptyWindowsByBlock}
          streams={null}
          viewMode="windows"
          physioProfile={null}
          sportType="Run"
        />
      );
    });

    expect(container.innerHTML).toBe("");
  });
});
