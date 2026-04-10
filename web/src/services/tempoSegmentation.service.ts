/**
 * Frontend tempo block segmentation service.
 *
 * Replicates the backend logic from `segmentation.py` to compute splits
 * (Q1-Q4, 1re/2e moitié) only on the tempo block defined by detected or
 * manual intervals — instead of the full session.
 */
import type { StreamPoint, ActivityInterval, SegmentPhaseMetrics } from "@/types/activity";
import {
  getStreamTimeMap,
  mapElapsedToChartSec,
} from "@/lib/activityBlocks";

// ── Sport detection (replicates segmentation.py:30-34) ───────

interface SportFlags {
  isBike: boolean;
  isRun: boolean;
  isHomeTrainer: boolean;
  isIntervalHint: boolean;
}

const BIKE_KEYWORDS = ["bike", "ride", "cycling", "vélo", "vtt", "gravel"];
const RUN_KEYWORDS = ["run", "trail", "hiking", "randonnée", "ski", "course", "rando"];
const HT_KEYWORDS = ["home trainer", "home-trainer", "virtual ride", "ht"];

export function detectSportFlags(sportType: string, activityName: string): SportFlags {
  const s = `${sportType} ${activityName}`.toLowerCase();
  return {
    isBike: BIKE_KEYWORDS.some((k) => s.includes(k)),
    isRun: RUN_KEYWORDS.some((k) => s.includes(k)),
    isHomeTrainer: HT_KEYWORDS.some((k) => s.includes(k)),
    isIntervalHint: /\d+\s*[x*]\s*\d+/.test(s),
  };
}

// ── Math helpers ─────────────────────────────────────────────

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ── Per-phase segment calculation (replicates segmentation.py:12-85) ──

export function calculateSegment(
  points: StreamPoint[],
  flags: SportFlags,
): SegmentPhaseMetrics {
  if (points.length === 0) return { hr: null, speed: null, power: null, ratio: null, torque: null };

  // Common: avg HR
  const hrValues = points.filter((p) => p.hr != null).map((p) => p.hr!);
  let avgHr = mean(hrValues);

  let avgSpeed: number | null = null;
  let avgPower: number | null = null;
  let ratio: number | null = null;

  if (flags.isBike) {
    // ── Bike: power-based ──
    let pwrPoints = points.filter((p) => (p.pwr ?? 0) > 0);

    // HT / interval hint: apply power floor filter
    if (pwrPoints.length > 0 && (flags.isHomeTrainer || flags.isIntervalHint)) {
      const medianPwr = median(pwrPoints.map((p) => p.pwr!));
      const floorFactor = flags.isIntervalHint ? 0.7 : 0.45;
      const powerFloor = Math.max(100, medianPwr * floorFactor);
      const filtered = pwrPoints.filter((p) => p.pwr! >= powerFloor);
      if (filtered.length >= 30) pwrPoints = filtered;
    }

    avgPower = mean(pwrPoints.map((p) => p.pwr!));

    // HT / interval hint: also filter HR to points where power > floor
    if ((flags.isHomeTrainer || flags.isIntervalHint) && avgPower != null) {
      const medianPwr = median(points.filter((p) => (p.pwr ?? 0) > 0).map((p) => p.pwr!));
      const floorFactor = flags.isIntervalHint ? 0.7 : 0.45;
      const powerFloor = Math.max(100, medianPwr > 0 ? medianPwr * floorFactor : 100);
      const filteredHr = points
        .filter((p) => (p.pwr ?? 0) > 0 && p.pwr! >= powerFloor && p.hr != null)
        .map((p) => p.hr!);
      if (filteredHr.length >= 30) avgHr = mean(filteredHr);
    }

    if (avgPower && avgHr && avgHr > 0) {
      ratio = avgPower / avgHr;
    }
  } else if (flags.isRun) {
    // ── Run: speed-based ──
    const spdValues = points.filter((p) => (p.spd ?? 0) > 0).map((p) => p.spd!);
    const rawAvg = mean(spdValues);
    if (rawAvg != null) {
      // Backend: if raw avg < 15 it's m/s → convert to km/h
      avgSpeed = rawAvg < 15 ? rawAvg * 3.6 : rawAvg;
    }

    if (avgSpeed && avgHr && avgHr > 0) {
      ratio = avgSpeed / avgHr;
    }
  }

  return { hr: avgHr, speed: avgSpeed, power: avgPower, ratio, torque: null };
}

// ── Tempo block boundary detection ───────────────────────────

export function getTempoBlockBoundaries(
  intervals: ActivityInterval[],
  streams: StreamPoint[],
): { startSec: number; endSec: number } | null {
  const workIntervals = intervals.filter(
    (i) => i.type === "work" || i.type === "active",
  );
  if (workIntervals.length === 0) return null;

  const timeMap = getStreamTimeMap(streams);
  // Compute chartMax for clamping
  let chartMax: number | null = null;
  for (const pt of streams) {
    if (Number.isFinite(pt.t)) {
      chartMax = chartMax == null ? pt.t : Math.max(chartMax, pt.t);
    }
  }

  const chartBounds: number[] = [];

  for (const interval of workIntervals) {
    const rawStart = interval.start_time;
    const rawEnd = interval.end_time;

    if (interval.detection_source === "manual") {
      // Manual intervals are already in chart-time `t`
      chartBounds.push(rawStart, rawEnd);
    } else {
      // DB intervals are in elapsed time → convert to chart-time
      const mappedStart = mapElapsedToChartSec(rawStart, timeMap, chartMax);
      const mappedEnd = mapElapsedToChartSec(rawEnd, timeMap, chartMax);
      if (mappedStart != null) chartBounds.push(mappedStart);
      if (mappedEnd != null) chartBounds.push(mappedEnd);
    }
  }

  if (chartBounds.length < 2) return null;

  const startSec = Math.max(0, Math.min(...chartBounds));
  const endSec = Math.max(...chartBounds);

  if (endSec <= startSec) return null;
  return { startSec, endSec };
}

// ── Main: compute splits on tempo block ──────────────────────

export function computeTempoBlockSplits(
  streams: StreamPoint[],
  startSec: number,
  endSec: number,
  nPhases: number,
  sportType: string,
  activityName: string,
): Record<string, SegmentPhaseMetrics> | null {
  // Filter streams to the tempo block
  const blockPoints = streams.filter(
    (pt) => Number.isFinite(pt.t) && pt.t >= startSec && pt.t <= endSec,
  );

  const n = blockPoints.length;
  const step = Math.floor(n / nPhases);
  if (n === 0 || step === 0) return null;

  const flags = detectSportFlags(sportType, activityName);
  const splits: Record<string, SegmentPhaseMetrics> = {};

  for (let i = 0; i < nPhases; i++) {
    const start = i * step;
    const end = i < nPhases - 1 ? (i + 1) * step : n;
    const phasePoints = blockPoints.slice(start, end);
    splits[`phase_${i + 1}`] = calculateSegment(phasePoints, flags);
  }

  return splits;
}
