import { describe, expect, it } from "vitest";

import { buildAnalysisHighlights } from "./ActivityAnalysisSection";
import type { BlockGroupedIntervals, RepWindow } from "@/types/activity";

const intervalsByBlock: BlockGroupedIntervals[] = [
  {
    blockIndex: 1,
    label: "Bloc 1",
    intervals: [
      {
        id: "work-1",
        activity_id: "activity-1",
        type: "work",
        start_time: 10,
        end_time: 40,
        duration: 30,
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
        start_time: 40,
        end_time: 70,
        duration: 30,
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
        id: "work-2",
        activity_id: "activity-1",
        type: "active",
        start_time: 100,
        end_time: 135,
        duration: 35,
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
    { rep_index: 1, start_sec: 14, end_sec: 34, duration_sec: 20, hr_raw: 158, hr_corr: 156, output: 4.8, ea: 0.95 },
  ],
};

describe("buildAnalysisHighlights", () => {
  it("returns interval highlights for expanded blocks in intervals mode", () => {
    const highlights = buildAnalysisHighlights(
      intervalsByBlock,
      repWindowsByBlock,
      new Set([1, 2]),
      "intervals"
    );

    expect(highlights).toEqual([
      { startSec: 10, endSec: 40 },
      { startSec: 100, endSec: 135 },
    ]);
  });

  it("returns stabilized window highlights in windows mode without falling back to intervals", () => {
    const highlights = buildAnalysisHighlights(
      intervalsByBlock,
      repWindowsByBlock,
      new Set([1, 2]),
      "windows"
    );

    expect(highlights).toEqual([{ startSec: 14, endSec: 34 }]);
  });

  it("ignores blocks that are not expanded", () => {
    const highlights = buildAnalysisHighlights(
      intervalsByBlock,
      repWindowsByBlock,
      new Set([2]),
      "intervals"
    );

    expect(highlights).toEqual([{ startSec: 100, endSec: 135 }]);
  });
});
