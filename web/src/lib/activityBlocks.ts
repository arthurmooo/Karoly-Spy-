import type {
  Activity,
  ActivityInterval,
  BlockGroupedIntervals,
  IntervalBlock,
  ManualIntervalSegmentsBlock,
  StreamPoint,
} from "@/types/activity";
import { hasManualBlockOverride } from "@/services/manualIntervals.service";
import { speedToPaceDecimal } from "@/services/format.service";
import type { DetectedSegment } from "@/services/manualIntervals.service";

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

// ── Helpers ────────────────────────────────────────────────

export interface StreamTimeMapPoint {
  chartSec: number;
  elapsedSec: number;
}

function warnInDev(message: string, details: Record<string, unknown>) {
  if (import.meta.env.DEV) console.warn(message, details);
}

export function getStreamTimeMap(streams: StreamPoint[] | null | undefined): StreamTimeMapPoint[] {
  return (streams ?? [])
    .filter(
      (pt): pt is StreamPoint & { elapsed_t: number } =>
        Number.isFinite(pt.t) && typeof pt.elapsed_t === "number" && Number.isFinite(pt.elapsed_t)
    )
    .map((pt) => ({ chartSec: pt.t, elapsedSec: pt.elapsed_t }))
    .sort((a, b) => a.elapsedSec - b.elapsedSec);
}

export function mapElapsedToChartSec(
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

function getBlockManualOverride(activity: Activity, blockIndex: 1 | 2 | 3) {
  const prefix = `manual_interval_block_${blockIndex}_` as const;
  const a = activity as unknown as Record<string, number | null | undefined>;
  return {
    paceMean: a[`${prefix}pace_mean`] ?? null,
    paceLast: a[`${prefix}pace_last`] ?? null,
    powerMean: a[`${prefix}power_mean`] ?? null,
    powerLast: a[`${prefix}power_last`] ?? null,
    hrMean: a[`${prefix}hr_mean`] ?? null,
    hrLast: a[`${prefix}hr_last`] ?? null,
  };
}

function isManualBlockIndex(blockIndex: number): blockIndex is 1 | 2 | 3 {
  return blockIndex === 1 || blockIndex === 2 || blockIndex === 3;
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

function buildBlockSpecs(
  activity: Activity,
  blocks: IntervalBlock[] | undefined,
  manualSegs: Partial<Record<1 | 2 | 3, DetectedSegment[]>>
): BlockSpec[] {
  const blockByIndex = new Map<number, IntervalBlock>((blocks ?? []).map((b) => [b.block_index, b]));
  const manualIndexes = ([1, 2, 3] as const).filter((bi) => (manualSegs[bi]?.length ?? 0) > 0);
  const indexes = manualIndexes.length > 0
    ? new Set<number>(manualIndexes)
    : new Set<number>(blockByIndex.keys());
  if (manualIndexes.length === 0) {
    for (const bi of [1, 2, 3] as const) if (hasManualBlockOverride(activity, bi)) indexes.add(bi);
  }

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
    const pace = intv.avg_speed ? speedToPaceDecimal(intv.avg_speed) : null;
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
  manualSegs: Partial<Record<1 | 2 | 3, DetectedSegment[]>>, chartMaxSec: number | null
): DisplayBlock[] {
  const specs = buildBlockSpecs(activity, blocks, manualSegs);
  const detected = [...intervals].sort((a, b) => a.start_time - b.start_time);
  const timeMap = getStreamTimeMap(activity.activity_streams);
  const intSourceMax = getIntervalSourceMaxSec(activity, timeMap);
  let cursor = 0;

  return specs.map((spec) => {
    const manual = isManualBlockIndex(spec.blockIndex) ? manualSegs[spec.blockIndex] : undefined;
    const tc = spec.count ?? 0;
    const selected = tc > 0 ? detected.slice(cursor, cursor + tc) : [];
    if (tc > 0 && selected.length < tc && !manual?.length)
      warnInDev("Block requested more intervals than available", { activityId: activity.id, blockId: spec.id, blockIndex: spec.blockIndex, requested: tc, available: selected.length });
    if (tc > 0) cursor += tc;
    const rows = manual?.map(detectedSegmentToDisplayRow)
      ?? selected.map((i) => intervalToDisplayRow(i, timeMap, chartMaxSec, intSourceMax, activity)).filter((r): r is DisplayBlockRow => r != null);
    return { ...spec, rows };
  });
}

export function mapPersistedManualSegments(
  manualBlocks: ManualIntervalSegmentsBlock[] | null | undefined
): Partial<Record<1 | 2 | 3, DetectedSegment[]>> {
  const result: Partial<Record<1 | 2 | 3, DetectedSegment[]>> = {};
  for (const block of manualBlocks ?? []) {
    if (block.block_index !== 1 && block.block_index !== 2 && block.block_index !== 3) continue;
    result[block.block_index] = (block.segments ?? []).map((segment, index) => ({
      id: `${block.block_index}-${index}-${segment.start_sec}-${segment.end_sec}`,
      startSec: segment.start_sec,
      endSec: segment.end_sec,
      durationSec: segment.duration_sec,
      distanceM: segment.distance_m,
      avgValue: segment.avg_power ?? segment.avg_speed ?? segment.avg_hr ?? 0,
      avgHr: segment.avg_hr ?? null,
      avgSpeed: segment.avg_speed ?? null,
      avgPower: segment.avg_power ?? null,
    }));
  }
  return result;
}

export function computeEffectiveIntervals(
  dbIntervals: ActivityInterval[],
  manualSegs: Partial<Record<1 | 2 | 3, DetectedSegment[]>>,
  activityId: string,
): ActivityInterval[] {
  const allManual: DetectedSegment[] = [];
  for (const bi of [1, 2, 3] as const) {
    const segs = manualSegs[bi];
    if (segs?.length) allManual.push(...segs);
  }
  if (allManual.length === 0) return dbIntervals;
  allManual.sort((a, b) => a.startSec - b.startSec);
  return allManual.map((seg) => ({
    id: `manual-${seg.id}`,
    activity_id: activityId,
    type: "work",
    start_time: seg.startSec,
    end_time: seg.endSec,
    duration: seg.durationSec,
    avg_speed: seg.avgSpeed ?? null,
    avg_power: seg.avgPower ?? null,
    avg_hr: seg.avgHr ?? null,
    avg_cadence: null,
    detection_source: "manual",
    respect_score: null,
  }));
}

function segToInterval(seg: DetectedSegment, activityId: string): ActivityInterval {
  return {
    id: `manual-${seg.id}`,
    activity_id: activityId,
    type: "work",
    start_time: seg.startSec,
    end_time: seg.endSec,
    duration: seg.durationSec,
    avg_speed: seg.avgSpeed ?? null,
    avg_power: seg.avgPower ?? null,
    avg_hr: seg.avgHr ?? null,
    avg_cadence: null,
    detection_source: "manual",
    respect_score: null,
  };
}

export function computeBlockGroupedIntervals(
  dbIntervals: ActivityInterval[],
  manualSegs: Partial<Record<1 | 2 | 3, DetectedSegment[]>>,
  blocks: IntervalBlock[] | undefined,
  activityId: string,
  activity?: Activity,
): BlockGroupedIntervals[] {
  const manualEntries = ([1, 2, 3] as const)
    .map((blockIndex) => ({
      blockIndex,
      segments: manualSegs[blockIndex] ?? [],
    }))
    .filter((entry) => entry.segments.length > 0);

  if (manualEntries.length > 0) {
    return manualEntries.map((entry) => ({
      blockIndex: entry.blockIndex,
      label: `Bloc ${entry.blockIndex}`,
      intervals: entry.segments.map((segment) => segToInterval(segment, activityId)),
    }));
  }

  const sorted = [...dbIntervals].sort((a, b) => a.start_time - b.start_time);

  // Build merged set of block indexes from DB blocks + manual overrides
  const blockByIndex = new Map<number, IntervalBlock>((blocks ?? []).map((b) => [b.block_index, b]));
  const indexes = new Set<number>(blockByIndex.keys());
  if (activity) {
    for (const bi of [1, 2, 3] as const) {
      if (hasManualBlockOverride(activity, bi)) indexes.add(bi);
    }
  }

  if (indexes.size > 0) {
    const result: BlockGroupedIntervals[] = [];
    let cursor = 0;

    for (const bi of [...indexes].sort((a, b) => a - b)) {
      const block = blockByIndex.get(bi);
      const manual = isManualBlockIndex(bi) ? manualSegs[bi] : undefined;

      if (manual?.length) {
        result.push({
          blockIndex: bi,
          label: `Bloc ${bi}`,
          intervals: manual.map((s) => segToInterval(s, activityId)),
        });
      } else {
        // Use manual count override if available, else DB block count
        const manualCount = activity && isManualBlockIndex(bi) && hasManualBlockOverride(activity, bi)
          ? activity[`manual_interval_block_${bi}_count` as keyof Activity] as number | null | undefined
          : null;
        const count = manualCount ?? block?.count ?? 0;
        const slice = count > 0 ? sorted.slice(cursor, cursor + count) : [];
        if (count > 0) cursor += count;
        result.push({
          blockIndex: bi,
          label: `Bloc ${bi}`,
          intervals: slice,
        });
      }
    }
    return result;
  }

  // No blocks → single group with effective intervals (manual merged if present)
  const effective = computeEffectiveIntervals(dbIntervals, manualSegs, activityId);
  return effective.length > 0
    ? [{ blockIndex: 1, label: "Bloc 1", intervals: effective }]
    : [];
}
