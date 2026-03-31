import { describe, expect, it } from "vitest";

import { buildIntervalChartModel } from "./IntervalChart";
import type { BlockGroupedIntervals, RepWindow } from "@/types/activity";

const intervalsByBlock: BlockGroupedIntervals[] = [
  {
    blockIndex: 1,
    label: "Bloc 1",
    intervals: [
      {
        id: "int-1",
        activity_id: "activity-1",
        type: "work",
        start_time: 10,
        end_time: 70,
        duration: 60,
        avg_speed: 5,
        avg_power: null,
        avg_hr: 160,
        avg_cadence: null,
        detection_source: "manual",
        respect_score: null,
      },
      {
        id: "rec-1",
        activity_id: "activity-1",
        type: "recovery",
        start_time: 70,
        end_time: 120,
        duration: 50,
        avg_speed: 3,
        avg_power: null,
        avg_hr: 130,
        avg_cadence: null,
        detection_source: "manual",
        respect_score: null,
      },
    ],
  },
  {
    blockIndex: 2,
    label: "Bloc 2",
    intervals: [
      {
        id: "int-2",
        activity_id: "activity-1",
        type: "active",
        start_time: 150,
        end_time: 210,
        duration: 60,
        avg_speed: 5.2,
        avg_power: null,
        avg_hr: 165,
        avg_cadence: null,
        detection_source: "manual",
        respect_score: null,
      },
    ],
  },
];

const repWindowsByBlock: Record<number, RepWindow[]> = {
  1: [
    { rep_index: 1, start_sec: 20, end_sec: 55, duration_sec: 35, hr_raw: 158, hr_corr: 156, output: 4.8, ea: 0.95 },
    { rep_index: 2, start_sec: 25, end_sec: 60, duration_sec: 35, hr_raw: 162, hr_corr: 160, output: 4.9, ea: 0.96 },
  ],
  2: [
    { rep_index: 3, start_sec: 160, end_sec: 195, duration_sec: 35, hr_raw: 166, hr_corr: 164, output: 5.1, ea: 0.98 },
  ],
};

describe("buildIntervalChartModel", () => {
  it("keeps interval mode behavior on work intervals only", () => {
    const model = buildIntervalChartModel(intervalsByBlock, repWindowsByBlock, false, "intervals");

    expect(model.title).toBe("Évolution par intervalle");
    expect(model.xAxisLabel).toBe("N° intervalle");
    expect(model.labelPrefix).toBe("Intervalle");
    expect(model.data).toHaveLength(2);
    expect(model.data.map((point) => point.hr)).toEqual([160, 165]);
    expect(model.blockBoundaries).toEqual([{ index: 1.5, label: "Bloc 2" }]);
  });

  it("switches to stabilized windows data in windows mode", () => {
    const model = buildIntervalChartModel(intervalsByBlock, repWindowsByBlock, false, "windows");

    expect(model.title).toBe("Évolution par fenêtre stabilisée");
    expect(model.xAxisLabel).toBe("N° fenêtre");
    expect(model.labelPrefix).toBe("Fenêtre");
    expect(model.data).toHaveLength(3);
    expect(model.data[0]).toMatchObject({
      index: 1,
      hr: 156,
      hrRaw: 158,
      hrCorr: 156,
      pace: 60 / 4.8,
      output: 4.8,
      ea: 0.95,
    });
    expect(model.data[2]).toMatchObject({
      index: 3,
      hr: 164,
      hrRaw: 166,
      hrCorr: 164,
      pace: 60 / 5.1,
      output: 5.1,
      ea: 0.98,
    });
    expect(model.blockBoundaries).toEqual([{ index: 2.5, label: "Bloc 2" }]);
  });
});
