import { describe, expect, it } from "vitest";
import { buildTargetVsActualChartModel } from "./TargetVsActualChart";
import { formatPaceDecimal } from "@/services/format.service";
import type { BlockGroupedIntervals, PlannedIntervalBlock } from "@/types/activity";

describe("buildTargetVsActualChartModel", () => {
  it("uses planned_interval_blocks for run targets instead of realized block averages", () => {
    const intervalsByBlock: BlockGroupedIntervals[] = [
      {
        blockIndex: 1,
        label: "Bloc 1",
        intervals: [
          {
            id: "i1",
            activity_id: "a1",
            type: "active",
            start_time: 0,
            end_time: 90,
            duration: 90,
            avg_speed: 4.46,
            avg_power: null,
            avg_hr: 150,
            avg_cadence: null,
            detection_source: "lap",
            respect_score: null,
          },
        ],
      },
    ];
    const plannedBlocks: PlannedIntervalBlock[] = [
      {
        block_index: 1,
        count: 20,
        representative_duration_sec: 90,
        representative_distance_m: null,
        target_type: "speed",
        target_min: 4.5673076923,
        target_max: 5.0480769231,
        planned_source: "nolio_structured_workout",
      },
    ];

    const model = buildTargetVsActualChartModel(intervalsByBlock, plannedBlocks, false, false, formatPaceDecimal);

    expect(model.hasPlannedTargets).toBe(true);
    expect(model.chartData).toHaveLength(1);
    expect(model.chartData[0]?.plannedRangeLabel).toBe("3'39 /km - 3'18 /km");
    expect(model.chartData[0]?.actualLabel).toBe("3'44 /km");
  });

  it("returns unavailable when no planned blocks are present", () => {
    const model = buildTargetVsActualChartModel([], undefined, false, false, formatPaceDecimal);
    expect(model.hasPlannedTargets).toBe(false);
    expect(model.chartData).toEqual([]);
  });

  it("keeps bike targets in watts", () => {
    const intervalsByBlock: BlockGroupedIntervals[] = [
      {
        blockIndex: 1,
        label: "Bloc 1",
        intervals: [
          {
            id: "i1",
            activity_id: "a1",
            type: "active",
            start_time: 0,
            end_time: 300,
            duration: 300,
            avg_speed: null,
            avg_power: 325,
            avg_hr: 165,
            avg_cadence: null,
            detection_source: "lap",
            respect_score: null,
          },
        ],
      },
    ];
    const plannedBlocks: PlannedIntervalBlock[] = [
      {
        block_index: 1,
        count: 5,
        representative_duration_sec: 300,
        representative_distance_m: null,
        target_type: "power",
        target_min: 310,
        target_max: 330,
        planned_source: "nolio_structured_workout",
      },
    ];

    const model = buildTargetVsActualChartModel(intervalsByBlock, plannedBlocks, true, false, formatPaceDecimal);

    expect(model.chartData[0]?.plannedRangeLabel).toBe("310-330 W");
    expect(model.chartData[0]?.actualLabel).toBe("325 W");
  });
});
