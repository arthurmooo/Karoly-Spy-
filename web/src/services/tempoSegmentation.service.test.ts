import { describe, it, expect } from "vitest";
import {
  detectSportFlags,
  calculateSegment,
  getTempoBlockBoundaries,
  computeTempoBlockSplits,
} from "./tempoSegmentation.service";
import type { StreamPoint, ActivityInterval } from "@/types/activity";

// ── Helpers ──────────────────────────────────────────────────

function makeStream(overrides: Partial<StreamPoint> & { t: number }): StreamPoint {
  return { t: overrides.t, hr: 150, spd: 3.5, pwr: 250, ...overrides };
}

function makeStreams(count: number, step = 5, baseT = 0): StreamPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: baseT + i * step,
    elapsed_t: baseT + i * step,
    hr: 140 + Math.round(i * 0.1),
    spd: 3.5 + (i % 5) * 0.01,
    pwr: 200 + i,
  }));
}

function makeInterval(start: number, end: number, source = "lap"): ActivityInterval {
  return {
    id: `test-${start}`,
    activity_id: "test",
    type: "active",
    start_time: start,
    end_time: end,
    duration: end - start,
    avg_speed: 3.5,
    avg_power: null,
    avg_hr: 150,
    avg_cadence: null,
    detection_source: source,
    respect_score: null,
  };
}

// ── Sport Detection ──────────────────────────────────────────

describe("detectSportFlags", () => {
  it("detects bike sport", () => {
    const flags = detectSportFlags("Bike", "ENC Tempo Full Vélo");
    expect(flags.isBike).toBe(true);
    expect(flags.isRun).toBe(false);
  });

  it("detects run sport from sport_type containing course", () => {
    const flags = detectSportFlags("Run", "15Km Tempo");
    expect(flags.isRun).toBe(true);
    expect(flags.isBike).toBe(false);
  });

  it("detects VTT as bike", () => {
    expect(detectSportFlags("VTT", "Sortie Tempo").isBike).toBe(true);
  });

  it("detects home trainer", () => {
    const flags = detectSportFlags("Bike", "Home Trainer 60' Tempo");
    expect(flags.isHomeTrainer).toBe(true);
  });

  it("detects interval hint pattern", () => {
    const flags = detectSportFlags("Run", "3*20' Tempo");
    expect(flags.isIntervalHint).toBe(true);
  });

  it("does not detect interval hint for continuous tempo", () => {
    const flags = detectSportFlags("Run", "15Km Tempo + 2Km Z2");
    expect(flags.isIntervalHint).toBe(false);
  });
});

// ── calculateSegment ─────────────────────────────────────────

describe("calculateSegment", () => {
  const runFlags = { isBike: false, isRun: true, isHomeTrainer: false, isIntervalHint: false };
  const bikeFlags = { isBike: true, isRun: false, isHomeTrainer: false, isIntervalHint: false };

  it("returns nulls for empty points", () => {
    const result = calculateSegment([], runFlags);
    expect(result.hr).toBeNull();
    expect(result.speed).toBeNull();
    expect(result.ratio).toBeNull();
  });

  it("computes run segment: speed in km/h + ratio", () => {
    // speed 4.0 m/s = 14.4 km/h, HR 155
    const points = Array.from({ length: 10 }, () => makeStream({ t: 0, spd: 4.0, hr: 155 }));
    const result = calculateSegment(points, runFlags);

    expect(result.speed).toBeCloseTo(14.4, 1);
    expect(result.hr).toBe(155);
    expect(result.ratio).toBeCloseTo(14.4 / 155, 4);
  });

  it("filters out speed=0 for run", () => {
    const points = [
      makeStream({ t: 0, spd: 4.0, hr: 150 }),
      makeStream({ t: 5, spd: 0, hr: 145 }),
      makeStream({ t: 10, spd: 4.0, hr: 155 }),
    ];
    const result = calculateSegment(points, runFlags);
    // Only 2 speed points (4.0 m/s), all 3 HR points
    expect(result.speed).toBeCloseTo(4.0 * 3.6, 1);
    expect(result.hr).toBeCloseTo(150, 0);
  });

  it("computes bike segment: power + ratio", () => {
    const points = Array.from({ length: 10 }, () => makeStream({ t: 0, pwr: 250, hr: 150 }));
    const result = calculateSegment(points, bikeFlags);

    expect(result.power).toBe(250);
    expect(result.speed).toBeNull();
    expect(result.ratio).toBeCloseTo(250 / 150, 4);
  });

  it("filters out power=0 for bike", () => {
    const points = [
      makeStream({ t: 0, pwr: 250, hr: 150 }),
      makeStream({ t: 5, pwr: 0, hr: 145 }),
      makeStream({ t: 10, pwr: 260, hr: 155 }),
    ];
    const result = calculateSegment(points, bikeFlags);
    expect(result.power).toBeCloseTo(255, 0); // mean of 250, 260
  });

  it("applies HT power floor filter for bike", () => {
    const htFlags = { isBike: true, isRun: false, isHomeTrainer: true, isIntervalHint: false };
    // 35 points at 250W + 5 points at 50W (noise)
    const points = [
      ...Array.from({ length: 35 }, () => makeStream({ t: 0, pwr: 250, hr: 150 })),
      ...Array.from({ length: 5 }, () => makeStream({ t: 0, pwr: 50, hr: 120 })),
    ];
    const result = calculateSegment(points, htFlags);
    // Floor = max(100, median * 0.45). Median of 35x250 + 5x50 ≈ 250. Floor = 112.5
    // 50W < 112.5 → filtered out. Only 250W points remain
    expect(result.power).toBe(250);
  });

  it("sets torque to null", () => {
    const points = [makeStream({ t: 0 })];
    expect(calculateSegment(points, runFlags).torque).toBeNull();
    expect(calculateSegment(points, bikeFlags).torque).toBeNull();
  });
});

// ── getTempoBlockBoundaries ──────────────────────────────────

describe("getTempoBlockBoundaries", () => {
  it("returns null for empty intervals", () => {
    const streams = makeStreams(100);
    expect(getTempoBlockBoundaries([], streams)).toBeNull();
  });

  it("returns null if no work/active intervals", () => {
    const streams = makeStreams(100);
    const intervals = [makeInterval(100, 200)];
    intervals[0]!.type = "rest";
    expect(getTempoBlockBoundaries(intervals, streams)).toBeNull();
  });

  it("returns boundaries for single interval (manual = chart-time)", () => {
    const streams = makeStreams(200);
    const interval = makeInterval(100, 500, "manual");
    const result = getTempoBlockBoundaries([interval], streams);
    expect(result).toEqual({ startSec: 100, endSec: 500 });
  });

  it("returns min/max for multiple intervals", () => {
    const streams = makeStreams(200);
    const i1 = makeInterval(100, 400, "manual");
    const i2 = makeInterval(450, 600, "manual");
    const result = getTempoBlockBoundaries([i1, i2], streams);
    expect(result).toEqual({ startSec: 100, endSec: 600 });
  });

  it("converts DB intervals from elapsed to chart-time", () => {
    // Streams where t = elapsed_t (no pauses, simplest case)
    const streams: StreamPoint[] = Array.from({ length: 100 }, (_, i) => ({
      t: i * 5,
      elapsed_t: i * 5,
    }));
    const interval = makeInterval(50, 300, "lap"); // elapsed_t domain
    const result = getTempoBlockBoundaries([interval], streams);
    expect(result).not.toBeNull();
    expect(result!.startSec).toBeCloseTo(50, 0);
    expect(result!.endSec).toBeCloseTo(300, 0);
  });
});

// ── computeTempoBlockSplits ──────────────────────────────────

describe("computeTempoBlockSplits", () => {
  it("returns null for empty streams", () => {
    expect(computeTempoBlockSplits([], 0, 100, 4, "Run", "Tempo")).toBeNull();
  });

  it("returns null when block has too few points", () => {
    const streams = makeStreams(2, 5, 0); // 2 points
    expect(computeTempoBlockSplits(streams, 0, 10, 4, "Run", "Tempo")).toBeNull();
  });

  it("splits into 4 equal phases for run", () => {
    const streams = makeStreams(100, 5, 0); // t: 0, 5, 10, ... 495
    const result = computeTempoBlockSplits(streams, 0, 495, 4, "Run", "15Km Tempo");
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(["phase_1", "phase_2", "phase_3", "phase_4"]);
    // Each phase should have HR and speed
    for (const key of Object.keys(result!)) {
      expect(result![key]!.hr).toBeGreaterThan(0);
      expect(result![key]!.speed).toBeGreaterThan(0);
      expect(result![key]!.ratio).toBeGreaterThan(0);
      expect(result![key]!.power).toBeNull();
    }
  });

  it("splits into 2 phases", () => {
    const streams = makeStreams(100, 5, 0);
    const result = computeTempoBlockSplits(streams, 0, 495, 2, "Run", "Tempo");
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(["phase_1", "phase_2"]);
  });

  it("last phase gets remainder points", () => {
    // 103 points, 4 phases: 25 + 25 + 25 + 28
    const streams = makeStreams(103, 5, 0);
    const result = computeTempoBlockSplits(streams, 0, 510, 4, "Run", "Tempo");
    expect(result).not.toBeNull();
    expect(Object.keys(result!).length).toBe(4);
  });

  it("filters streams to block boundaries", () => {
    // 200 points total, but block is only 50-250 sec
    const streams = makeStreams(200, 5, 0); // t: 0..995
    const result = computeTempoBlockSplits(streams, 50, 250, 4, "Run", "Tempo");
    expect(result).not.toBeNull();
    // Block has points from t=50 to t=250 → (250-50)/5 + 1 = 41 points
    // 41 / 4 = 10 per phase (step=10), phase4 gets 11
  });

  it("computes bike phases with power", () => {
    const streams: StreamPoint[] = Array.from({ length: 80 }, (_, i) => ({
      t: i * 5,
      hr: 140 + i * 0.2,
      pwr: 230 + i,
      spd: 9.0,
    }));
    const result = computeTempoBlockSplits(streams, 0, 395, 4, "Bike", "60' Tempo (AMPK)");
    expect(result).not.toBeNull();
    for (const key of Object.keys(result!)) {
      expect(result![key]!.power).toBeGreaterThan(0);
      expect(result![key]!.ratio).toBeGreaterThan(0);
      expect(result![key]!.speed).toBeNull(); // bike uses power, not speed
    }
  });

  it("repeat pattern detection in isIntervalHint", () => {
    // This is tested via detectSportFlags but verify it doesn't crash computeTempoBlockSplits
    const streams = makeStreams(40, 5, 0);
    const result = computeTempoBlockSplits(streams, 0, 195, 4, "Run", "3*20' Tempo");
    expect(result).not.toBeNull(); // Still computes — the guard is in ActivityAnalysisSection
  });
});
