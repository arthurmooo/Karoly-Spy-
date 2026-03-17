import type { Activity, ActivityInterval, IntervalBlock, StreamPoint } from "@/types/activity";
import { hasManualBlockOverride } from "@/services/manualIntervals.service";
import type { DetectedSegment, ManualBlockOverridePayload } from "@/services/manualIntervals.service";

// ── Types ──────────────────────────────────────────────────

export interface DisplayBlock {
  id: string;
  label: string;
  durationSec: number | null;
  paceMean: number | null;
  paceLast: number | null;
  powerMean: number | null;
  powerLast: number | null;
  hrMean: number | null;
  hrLast: number | null;
  source: string | null;
  count: number | null;
  rows: DisplayBlockRow[];
}

export interface DisplayBlockRow {
  id: string;
  rawStartSec: number | null;
  rawEndSec: number | null;
  startSec: number | null;
  endSec: number | null;
  durationSec: number | null;
  avgSpeed: number | null;
  avgPower: number | null;
  avgHr: number | null;
  avgCadence: number | null;
  source: string | null;
  origin: "interval" | "manual";
}

export const INTERVAL_TYPE_LABELS: Record<string, string> = {
  work: "Effort",
  rest: "Récup",
  warmup: "Échauffement",
  cooldown: "Retour calme",
};

export const MANUAL_BLOCK_SEGMENTS_STORAGE_KEY = "activity-detail:manual-block-segments:v1";

export type StoredManualSegments = Record<
  string,
  Partial<Record<"1" | "2", { fingerprint: string; segments: DetectedSegment[] }>>
>;

// ── Helpers ────────────────────────────────────────────────

interface StreamTimeMapPoint {
  chartSec: number;
  elapsedSec: number;
}

function warnInDev(message: string, details: Record<string, unknown>) {
  if (import.meta.env.DEV) console.warn(message, details);
}

function getStreamTimeMap(streams: StreamPoint[] | null | undefined): StreamTimeMapPoint[] {
  return (streams ?? [])
    .filter(
      (pt): pt is StreamPoint & { elapsed_t: number } =>
        Number.isFinite(pt.t) && typeof pt.elapsed_t === "number" && Number.isFinite(pt.elapsed_t)
    )
    .map((pt) => ({ chartSec: pt.t, elapsedSec: pt.elapsed_t }))
    .sort((a, b) => a.elapsedSec - b.elapsedSec);
}

function mapElapsedToChartSec(
  elapsedSec: number | null,
  timeMap: StreamTimeMapPoint[],
  chartMaxSec: number | null
): number | null {
  if (elapsedSec == null) return null;
  if (!timeMap.length) return elapsedSec;
  const first = timeMap[0]!;
  if (elapsedSec <= first.elapsedSec) return Math.max(0, first.chartSec + (elapsedSec - first.elapsedSec));
  for (let i = 1; i < timeMap.length; i++) {
    const prev = timeMap[i - 1]!;
    const cur = timeMap[i]!;
    if (elapsedSec > cur.elapsedSec) continue;
    const delta = cur.elapsedSec - prev.elapsedSec;
    if (delta <= 0) return prev.chartSec;
    const ratio = (elapsedSec - prev.elapsedSec) / delta;
    return prev.chartSec + ratio * (cur.chartSec - prev.chartSec);
  }
  const last = timeMap[timeMap.length - 1]!;
  const projected = last.chartSec + (elapsedSec - last.elapsedSec);
  return chartMaxSec != null ? Math.min(chartMaxSec, projected) : projected;
}

function getIntervalSourceMaxSec(activity: Activity, timeMap: StreamTimeMapPoint[]): number | null {
  const elapsedMax = timeMap.length > 0 ? timeMap[timeMap.length - 1]!.elapsedSec : null;
  const candidates = [elapsedMax, activity.duration_sec, activity.moving_time_sec].filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0
  );
  return candidates.length === 0 ? null : Math.max(...candidates);
}

function intervalToDisplayRow(
  interval: ActivityInterval,
  timeMap: StreamTimeMapPoint[],
  chartMaxSec: number | null,
  intervalSourceMaxSec: number | null,
  activity: Activity
): DisplayBlockRow | null {
  const rawStart = interval.start_time ?? null;
  const rawEnd = interval.end_time ?? null;
  const mappedStart = mapElapsedToChartSec(rawStart, timeMap, chartMaxSec);
  const mappedEnd = mapElapsedToChartSec(rawEnd, timeMap, chartMaxSec);
  const startSec = mappedStart != null ? Math.max(0, mappedStart) : null;
  const endSec = mappedEnd != null ? (chartMaxSec != null ? Math.min(chartMaxSec, mappedEnd) : mappedEnd) : null;

  if (intervalSourceMaxSec != null) {
    if (rawStart != null && rawStart > intervalSourceMaxSec + 5)
      warnInDev("Interval start exceeds chart range", { activityId: activity.id, intervalId: interval.id, rawStart, intervalSourceMaxSec });
    if (rawEnd != null && rawEnd > intervalSourceMaxSec + 5)
      warnInDev("Interval end exceeds chart range", { activityId: activity.id, intervalId: interval.id, rawEnd, intervalSourceMaxSec });
  }
  if (startSec != null && endSec != null && endSec <= startSec) {
    warnInDev("Interval dropped — invalid bounds", { activityId: activity.id, intervalId: interval.id, rawStart, rawEnd, startSec, endSec, chartMaxSec });
    return null;
  }
  return {
    id: interval.id, rawStartSec: rawStart, rawEndSec: rawEnd, startSec, endSec,
    durationSec: interval.duration ?? null, avgSpeed: interval.avg_speed ?? null,
    avgPower: interval.avg_power ?? null, avgHr: interval.avg_hr ?? null,
    avgCadence: interval.avg_cadence ?? null, source: interval.detection_source ?? null, origin: "interval",
  };
}

function detectedSegmentToDisplayRow(segment: DetectedSegment): DisplayBlockRow {
  return {
    id: `manual-${segment.id}`, rawStartSec: segment.startSec, rawEndSec: segment.endSec,
    startSec: segment.startSec, endSec: segment.endSec, durationSec: segment.durationSec,
    avgSpeed: segment.avgSpeed ?? null, avgPower: segment.avgPower ?? null,
    avgHr: segment.avgHr ?? null, avgCadence: null, source: "manuel", origin: "manual",
  };
}

function getBlockManualOverride(activity: Activity, blockIndex: 1 | 2) {
  if (blockIndex === 1) {
    return {
      paceMean: activity.manual_interval_block_1_pace_mean ?? null,
      paceLast: activity.manual_interval_block_1_pace_last ?? null,
      powerMean: activity.manual_interval_block_1_power_mean ?? null,
      powerLast: activity.manual_interval_block_1_power_last ?? null,
      hrMean: activity.manual_interval_block_1_hr_mean ?? null,
      hrLast: activity.manual_interval_block_1_hr_last ?? null,
    };
  }
  return {
    paceMean: activity.manual_interval_block_2_pace_mean ?? null,
    paceLast: activity.manual_interval_block_2_pace_last ?? null,
    powerMean: activity.manual_interval_block_2_power_mean ?? null,
    powerLast: activity.manual_interval_block_2_power_last ?? null,
    hrMean: activity.manual_interval_block_2_hr_mean ?? null,
    hrLast: activity.manual_interval_block_2_hr_last ?? null,
  };
}

function isManualBlockIndex(blockIndex: number): blockIndex is 1 | 2 {
  return blockIndex === 1 || blockIndex === 2;
}

interface BlockSpec {
  id: string;
  blockIndex: number;
  label: string;
  durationSec: number | null;
  paceMean: number | null;
  paceLast: number | null;
  powerMean: number | null;
  powerLast: number | null;
  hrMean: number | null;
  hrLast: number | null;
  source: string | null;
  count: number | null;
}

function getDisplayDuration(manualDuration: number | null | undefined, block: IntervalBlock | undefined): number | null {
  return manualDuration ?? block?.total_duration_sec ?? block?.representative_duration_sec ?? null;
}

function buildBlockSpecs(activity: Activity, blocks: IntervalBlock[] | undefined): BlockSpec[] {
  const blockByIndex = new Map<number, IntervalBlock>((blocks ?? []).map((b) => [b.block_index, b]));
  const indexes = new Set<number>(blockByIndex.keys());
  for (const bi of [1, 2] as const) if (hasManualBlockOverride(activity, bi)) indexes.add(bi);

  const specs: BlockSpec[] = [];
  for (const bi of [...indexes].sort((a, b) => a - b)) {
    const block = blockByIndex.get(bi);
    const hasManual = isManualBlockIndex(bi) && hasManualBlockOverride(activity, bi);
    if (!block && !hasManual) continue;
    const manual = hasManual ? getBlockManualOverride(activity, bi) : { paceMean: null, paceLast: null, powerMean: null, powerLast: null, hrMean: null, hrLast: null };
    const mc = hasManual ? activity[`manual_interval_block_${bi}_count` as keyof Activity] as number | null | undefined : null;
    const md = hasManual ? activity[`manual_interval_block_${bi}_duration_sec` as keyof Activity] as number | null | undefined : null;
    specs.push({
      id: `segmented-${bi}`, blockIndex: bi, label: `Bloc ${bi}`,
      durationSec: getDisplayDuration(hasManual ? md : null, block),
      paceMean: manual.paceMean ?? block?.interval_pace_mean ?? null,
      paceLast: manual.paceLast ?? block?.interval_pace_last ?? null,
      powerMean: manual.powerMean ?? block?.interval_power_mean ?? null,
      powerLast: manual.powerLast ?? block?.interval_power_last ?? null,
      hrMean: manual.hrMean ?? block?.interval_hr_mean ?? null,
      hrLast: manual.hrLast ?? block?.interval_hr_last ?? null,
      source: hasManual ? "manuel" : "segmented_metrics",
      count: hasManual && mc != null ? mc : (block?.count ?? null),
    });
  }
  return specs;
}

// ── Exported functions ─────────────────────────────────────

export function getChartMaxSec(activity: Activity): number | null {
  let streamMaxSec: number | null = null;
  for (const point of activity.activity_streams ?? []) {
    if (!Number.isFinite(point.t)) continue;
    streamMaxSec = streamMaxSec == null ? point.t : Math.max(streamMaxSec, point.t);
  }
  const candidates = [streamMaxSec, activity.moving_time_sec, activity.duration_sec].filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0
  );
  return candidates.length === 0 ? null : Math.max(...candidates);
}

export function buildBlocksFromIntervals(intervals: ActivityInterval[]): DisplayBlock[] {
  return intervals.map((intv, i) => {
    const pace = intv.avg_speed ? 1000 / intv.avg_speed / 60 : null;
    return {
      id: intv.id, label: INTERVAL_TYPE_LABELS[intv.type] ?? `Bloc ${i + 1}`,
      durationSec: intv.duration ?? null, paceMean: pace, paceLast: pace,
      powerMean: intv.avg_power ?? null, powerLast: intv.avg_power ?? null,
      hrMean: intv.avg_hr ?? null, hrLast: intv.avg_hr ?? null,
      source: intv.detection_source ?? null, count: null, rows: [],
    };
  });
}

export function buildResolvedBlocks(
  activity: Activity, blocks: IntervalBlock[] | undefined, intervals: ActivityInterval[],
  manualSegs: Partial<Record<1 | 2, DetectedSegment[]>>, chartMaxSec: number | null
): DisplayBlock[] {
  const specs = buildBlockSpecs(activity, blocks);
  const detected = [...intervals].sort((a, b) => a.start_time - b.start_time);
  const timeMap = getStreamTimeMap(activity.activity_streams);
  const intSourceMax = getIntervalSourceMaxSec(activity, timeMap);
  let cursor = 0;

  return specs.map((spec) => {
    const manual = isManualBlockIndex(spec.blockIndex) ? manualSegs[spec.blockIndex] : undefined;
    const tc = spec.count ?? 0;
    const selected = tc > 0 ? detected.slice(cursor, cursor + tc) : [];
    if (tc > 0 && selected.length < tc)
      warnInDev("Block requested more intervals than available", { activityId: activity.id, blockId: spec.id, blockIndex: spec.blockIndex, requested: tc, available: selected.length });
    if (tc > 0) cursor += tc;
    const rows = manual?.map(detectedSegmentToDisplayRow)
      ?? selected.map((i) => intervalToDisplayRow(i, timeMap, chartMaxSec, intSourceMax, activity)).filter((r): r is DisplayBlockRow => r != null);
    return { ...spec, rows };
  });
}

export function mergeActivityWithPayload(activity: Activity, payload: ManualBlockOverridePayload): Activity {
  return { ...activity, ...payload };
}

export function getManualBlockFingerprint(activity: Activity, blockIndex: 1 | 2): string | null {
  const prefix = `manual_interval_block_${blockIndex}_` as const;
  const fp = {
    count: activity[`${prefix}count`] ?? null, durationSec: activity[`${prefix}duration_sec`] ?? null,
    paceMean: activity[`${prefix}pace_mean`] ?? null, paceLast: activity[`${prefix}pace_last`] ?? null,
    powerMean: activity[`${prefix}power_mean`] ?? null, powerLast: activity[`${prefix}power_last`] ?? null,
    hrMean: activity[`${prefix}hr_mean`] ?? null, hrLast: activity[`${prefix}hr_last`] ?? null,
  };
  if (Object.values(fp).every((v) => v == null)) return null;
  return JSON.stringify(fp);
}

export function readStoredManualSegments(): StoredManualSegments {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MANUAL_BLOCK_SEGMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredManualSegments;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

export function writeStoredManualSegments(value: StoredManualSegments) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANUAL_BLOCK_SEGMENTS_STORAGE_KEY, JSON.stringify(value));
}
