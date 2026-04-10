import type {
  Activity,
  IntervalBlock,
  ManualIntervalSegment,
  ManualIntervalSegmentsBlock,
  StreamPoint,
} from "@/types/activity";

export type ManualDetectionMode = "duration" | "distance";
export type ManualDetectionMetric = "speed" | "power" | "heart_rate";

export interface DetectedSegment {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  distanceM: number;
  avgValue: number;
  avgHr: number | null;
  avgSpeed: number | null;
  avgPower: number | null;
}

export interface ManualBlockOverridePayload {
  manual_interval_power_mean: number | null;
  manual_interval_power_last: number | null;
  manual_interval_hr_mean: number | null;
  manual_interval_hr_last: number | null;
  manual_interval_pace_mean: number | null;
  manual_interval_pace_last: number | null;
  manual_interval_block_1_power_mean: number | null;
  manual_interval_block_1_power_last: number | null;
  manual_interval_block_1_hr_mean: number | null;
  manual_interval_block_1_hr_last: number | null;
  manual_interval_block_1_pace_mean: number | null;
  manual_interval_block_1_pace_last: number | null;
  manual_interval_block_1_count: number | null;
  manual_interval_block_1_duration_sec: number | null;
  manual_interval_block_2_power_mean: number | null;
  manual_interval_block_2_power_last: number | null;
  manual_interval_block_2_hr_mean: number | null;
  manual_interval_block_2_hr_last: number | null;
  manual_interval_block_2_pace_mean: number | null;
  manual_interval_block_2_pace_last: number | null;
  manual_interval_block_2_count: number | null;
  manual_interval_block_2_duration_sec: number | null;
  manual_interval_block_3_power_mean: number | null;
  manual_interval_block_3_power_last: number | null;
  manual_interval_block_3_hr_mean: number | null;
  manual_interval_block_3_hr_last: number | null;
  manual_interval_block_3_pace_mean: number | null;
  manual_interval_block_3_pace_last: number | null;
  manual_interval_block_3_count: number | null;
  manual_interval_block_3_duration_sec: number | null;
}

export interface ManualIntervalsUpdatePayload {
  overrides: ManualBlockOverridePayload;
  manual_interval_segments: ManualIntervalSegmentsBlock[];
  reset_to_auto: boolean;
}

interface DetectionOptions {
  streams: StreamPoint[];
  mode: ManualDetectionMode;
  metric: ManualDetectionMetric;
  repetitions: number;
  targetDurationSec?: number;
  targetDistanceM?: number;
  excludedSegments?: SegmentTimeRange[];
  timeRangeStartSec?: number;
  timeRangeEndSec?: number;
}

export interface SegmentTimeRange {
  startSec: number;
  endSec: number;
}

interface PreparedSample {
  index: number;
  t: number;
  dt: number;
  hr: number | null;
  spd: number | null;
  pwr: number | null;
  distanceStart: number;
  distanceEnd: number;
}

interface WindowStats {
  startSec: number;
  endSec: number;
  durationSec: number;
  distanceM: number;
  avgValue: number | null;
  avgHr: number | null;
  avgSpeed: number | null;
  avgPower: number | null;
}

interface ResolvedBlockMetrics {
  blockIndex: 1 | 2 | 3;
  count: number | null;
  representativeDurationSec: number | null;
  paceMean: number | null;
  paceLast: number | null;
  powerMean: number | null;
  powerLast: number | null;
  hrMean: number | null;
  hrLast: number | null;
}

function serializeManualSegment(segment: DetectedSegment): ManualIntervalSegment {
  return {
    start_sec: Math.round(segment.startSec * 10) / 10,
    end_sec: Math.round(segment.endSec * 10) / 10,
    duration_sec: Math.round(segment.durationSec * 10) / 10,
    distance_m: Math.round(segment.distanceM * 10) / 10,
    avg_speed: round2(segment.avgSpeed ?? null),
    avg_power: round1(segment.avgPower ?? null),
    avg_hr: round1(segment.avgHr ?? null),
  };
}

function readManualSegmentBlocks(activity: Activity): ManualIntervalSegmentsBlock[] {
  return [...(activity.manual_interval_segments ?? [])]
    .map((block) => ({
      block_index: block.block_index,
      segments: [...(block.segments ?? [])],
    }))
    .sort((left, right) => left.block_index - right.block_index);
}

function mergeManualSegmentBlocks(
  activity: Activity,
  blockIndex: 1 | 2 | 3,
  segments: DetectedSegment[] | null
): ManualIntervalSegmentsBlock[] {
  const next = new Map<number, ManualIntervalSegmentsBlock>(
    readManualSegmentBlocks(activity).map((block) => [block.block_index, block])
  );

  if (segments && segments.length > 0) {
    next.set(blockIndex, {
      block_index: blockIndex,
      segments: segments.map(serializeManualSegment),
    });
  } else {
    next.delete(blockIndex);
  }

  return [...next.values()]
    .filter((block) => block.segments.length > 0)
    .sort((left, right) => left.block_index - right.block_index);
}

const DEFAULT_SAMPLE_DT = 5;

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

function round2(value: number | null): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

export function speedToPaceDecimal(speed: number | null): number | null {
  if (speed == null || speed <= 0) return null;
  return 1000 / speed / 60;
}

function getMetricValue(sample: PreparedSample, metric: ManualDetectionMetric): number | null {
  if (metric === "heart_rate") return sample.hr;
  if (metric === "power") return sample.pwr;
  return sample.spd;
}

function getMedianStep(streams: StreamPoint[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < streams.length; i += 1) {
    const diff = streams[i]!.t - streams[i - 1]!.t;
    if (diff > 0) diffs.push(diff);
  }
  if (diffs.length === 0) return DEFAULT_SAMPLE_DT;
  const sorted = [...diffs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? DEFAULT_SAMPLE_DT;
}

function prepareSamples(streams: StreamPoint[]): PreparedSample[] {
  if (!streams.length) return [];

  const sorted = [...streams].sort((a, b) => a.t - b.t);
  const fallbackDt = getMedianStep(sorted);
  let cumulativeDistance = 0;

  return sorted.map((point, index) => {
    const next = sorted[index + 1];
    const rawDt = next ? next.t - point.t : fallbackDt;
    const dt = rawDt > 0 ? rawDt : fallbackDt;
    const speed = point.spd ?? null;
    const distanceStart = cumulativeDistance;
    cumulativeDistance += Math.max(speed ?? 0, 0) * dt;
    return {
      index,
      t: point.t,
      dt,
      hr: point.hr ?? null,
      spd: speed,
      pwr: point.pwr ?? null,
      distanceStart,
      distanceEnd: cumulativeDistance,
    };
  });
}

function buildWindowStats(
  samples: PreparedSample[],
  startIndex: number,
  mode: ManualDetectionMode,
  metric: ManualDetectionMetric,
  targetValue: number
): WindowStats | null {
  const startSample = samples[startIndex];
  if (!startSample) return null;

  const startSec = startSample.t;
  const startDistance = startSample.distanceStart;
  const targetEndSec = mode === "duration" ? startSec + targetValue : Number.POSITIVE_INFINITY;
  const targetEndDistance =
    mode === "distance" ? startDistance + targetValue : Number.POSITIVE_INFINITY;

  let endSec = startSec;
  let durationSec = 0;
  let distanceM = 0;
  let metricWeightedSum = 0;
  let metricWeight = 0;
  let hrWeightedSum = 0;
  let hrWeight = 0;
  let speedWeightedSum = 0;
  let speedWeight = 0;
  let powerWeightedSum = 0;
  let powerWeight = 0;

  for (let i = startIndex; i < samples.length; i += 1) {
    const sample = samples[i]!;
    const sampleEndSec = sample.t + sample.dt;
    const sampleEndDistance = sample.distanceEnd;

    let coveredDuration = sample.dt;
    if (mode === "duration") {
      coveredDuration = Math.max(0, Math.min(sampleEndSec, targetEndSec) - sample.t);
    } else if (mode === "distance") {
      if (sample.distanceStart >= targetEndDistance) break;
      if (sampleEndDistance > targetEndDistance) {
        const sampleDistance = sampleEndDistance - sample.distanceStart;
        if (sampleDistance > 0) {
          const fraction = (targetEndDistance - sample.distanceStart) / sampleDistance;
          coveredDuration = sample.dt * fraction;
        }
      }
    }

    if (coveredDuration <= 0) continue;

    const coveredDistance = Math.max(sample.spd ?? 0, 0) * coveredDuration;
    durationSec += coveredDuration;
    distanceM += coveredDistance;
    endSec = sample.t + coveredDuration;

    const metricValue = getMetricValue(sample, metric);
    if (metricValue != null) {
      metricWeightedSum += metricValue * coveredDuration;
      metricWeight += coveredDuration;
    }
    if (sample.hr != null) {
      hrWeightedSum += sample.hr * coveredDuration;
      hrWeight += coveredDuration;
    }
    if (sample.spd != null) {
      speedWeightedSum += sample.spd * coveredDuration;
      speedWeight += coveredDuration;
    }
    if (sample.pwr != null) {
      powerWeightedSum += sample.pwr * coveredDuration;
      powerWeight += coveredDuration;
    }

    if (mode === "duration" && endSec >= targetEndSec - 0.001) break;
    if (mode === "distance" && distanceM >= targetValue * 0.999) break;
  }

  if (metricWeight <= 0 || durationSec <= 0) return null;

  const coverageRatio =
    mode === "duration" ? durationSec / targetValue : distanceM / targetValue;
  if (coverageRatio < 0.9) return null;

  return {
    startSec,
    endSec,
    durationSec,
    distanceM,
    avgValue: metricWeightedSum / metricWeight,
    avgHr: hrWeight > 0 ? hrWeightedSum / hrWeight : null,
    avgSpeed: speedWeight > 0 ? speedWeightedSum / speedWeight : null,
    avgPower: powerWeight > 0 ? powerWeightedSum / powerWeight : null,
  };
}

function rangesOverlap(a: SegmentTimeRange, b: SegmentTimeRange): boolean {
  return a.startSec < b.endSec && a.endSec > b.startSec;
}

export function overlapsExcludedSegments(
  candidate: SegmentTimeRange,
  excludedSegments: SegmentTimeRange[]
): boolean {
  return excludedSegments.some((segment) => rangesOverlap(candidate, segment));
}

export function getExcludedSegmentsForBlock(
  manualBlocks: ManualIntervalSegmentsBlock[] | null | undefined,
  activeBlockIndex: 1 | 2 | 3
): SegmentTimeRange[] {
  return (manualBlocks ?? [])
    .filter((block) => block.block_index !== activeBlockIndex)
    .flatMap((block) =>
      (block.segments ?? []).map((segment) => ({
        startSec: segment.start_sec,
        endSec: segment.end_sec,
      }))
    );
}

export function detectBestSegments(options: DetectionOptions): DetectedSegment[] {
  const {
    streams,
    mode,
    metric,
    repetitions,
    targetDurationSec,
    targetDistanceM,
    excludedSegments = [],
    timeRangeStartSec,
    timeRangeEndSec,
  } = options;
  const targetValue = mode === "duration" ? targetDurationSec : targetDistanceM;

  if (!streams.length || !targetValue || repetitions <= 0) return [];

  const samples = prepareSamples(streams);

  const startIdx = timeRangeStartSec != null
    ? samples.findIndex((s) => s.t >= timeRangeStartSec)
    : 0;
  let endIdx = samples.length - 1;
  if (timeRangeEndSec != null) {
    endIdx = -1;
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      if (samples[i]!.t <= timeRangeEndSec) { endIdx = i; break; }
    }
  }
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return [];

  let candidates: DetectedSegment[] = [];

  for (let i = startIdx; i <= endIdx; i += 1) {
    const stats = buildWindowStats(samples, i, mode, metric, targetValue);
    if (!stats || stats.avgValue == null) continue;

    candidates.push({
      id: `${stats.startSec}-${stats.endSec}-${i}`,
      startSec: stats.startSec,
      endSec: stats.endSec,
      durationSec: stats.durationSec,
      distanceM: stats.distanceM,
      avgValue: stats.avgValue,
      avgHr: stats.avgHr,
      avgSpeed: stats.avgSpeed,
      avgPower: stats.avgPower,
    });
  }

  if (timeRangeEndSec != null) {
    candidates = candidates.filter((c) => c.endSec <= timeRangeEndSec + 0.5);
  }

  candidates.sort((a, b) => {
    if (b.avgValue !== a.avgValue) return b.avgValue - a.avgValue;
    return a.startSec - b.startSec;
  });

  const selected: DetectedSegment[] = [];
  for (const candidate of candidates) {
    if (selected.length >= repetitions) break;
    if (overlapsExcludedSegments(candidate, excludedSegments)) continue;
    if (selected.some((current) => rangesOverlap(current, candidate))) continue;
    selected.push(candidate);
  }

  return selected.sort((a, b) => a.startSec - b.startSec);
}

export function getBlockDefaults(block: IntervalBlock | undefined) {
  return {
    count: block?.count && block.count > 0 ? block.count : 5,
    durationSec:
      block?.representative_duration_sec && block.representative_duration_sec > 0
        ? Math.round(block.representative_duration_sec)
        : null,
    distanceM:
      block?.representative_distance_m && block.representative_distance_m > 0
        ? Math.round(block.representative_distance_m)
        : null,
  };
}

export function resolveBlockMetrics(
  activity: Activity,
  blockIndex: 1 | 2 | 3
): ResolvedBlockMetrics {
  const baseBlock = activity.segmented_metrics?.interval_blocks?.[blockIndex - 1];
  const prefix = `manual_interval_block_${blockIndex}_` as const;

  const paceMean = activity[`${prefix}pace_mean`] ?? baseBlock?.interval_pace_mean ?? null;
  const paceLast = activity[`${prefix}pace_last`] ?? baseBlock?.interval_pace_last ?? null;
  const powerMean = activity[`${prefix}power_mean`] ?? baseBlock?.interval_power_mean ?? null;
  const powerLast = activity[`${prefix}power_last`] ?? baseBlock?.interval_power_last ?? null;
  const hrMean = activity[`${prefix}hr_mean`] ?? baseBlock?.interval_hr_mean ?? null;
  const hrLast = activity[`${prefix}hr_last`] ?? baseBlock?.interval_hr_last ?? null;

  const manualCount = activity[`manual_interval_block_${blockIndex}_count` as keyof Activity] as number | null | undefined;
  const manualDuration = activity[`manual_interval_block_${blockIndex}_duration_sec` as keyof Activity] as number | null | undefined;

  return {
    blockIndex,
    count: manualCount ?? baseBlock?.count ?? null,
    representativeDurationSec:
      manualDuration ?? baseBlock?.representative_duration_sec ?? baseBlock?.total_duration_sec ?? null,
    paceMean,
    paceLast,
    powerMean,
    powerLast,
    hrMean,
    hrLast,
  };
}

export function hasManualBlockOverride(activity: Activity, blockIndex: 1 | 2 | 3): boolean {
  const prefix = `manual_interval_block_${blockIndex}_` as const;
  return (
    activity.manual_interval_segments?.some(
      (block) => block.block_index === blockIndex && block.segments.length > 0
    ) ||
    activity[`${prefix}pace_mean`] != null ||
    activity[`${prefix}pace_last`] != null ||
    activity[`${prefix}power_mean`] != null ||
    activity[`${prefix}power_last`] != null ||
    activity[`${prefix}hr_mean`] != null ||
    activity[`${prefix}hr_last`] != null ||
    activity[`${prefix}count`] != null
  );
}

function buildBlockMetricUpdate(
  activity: Activity,
  blockIndex: 1 | 2 | 3,
  segments: DetectedSegment[] | null
) {
  const payload: Partial<ManualBlockOverridePayload> = {};
  const prefix = `manual_interval_block_${blockIndex}_` as const;

  if (!segments || segments.length === 0) {
    payload[`${prefix}power_mean`] = null;
    payload[`${prefix}power_last`] = null;
    payload[`${prefix}hr_mean`] = null;
    payload[`${prefix}hr_last`] = null;
    payload[`${prefix}pace_mean`] = null;
    payload[`${prefix}pace_last`] = null;
    payload[`${prefix}count` as keyof ManualBlockOverridePayload] = null;
    payload[`${prefix}duration_sec` as keyof ManualBlockOverridePayload] = null;
    return payload;
  }

  const totalDuration = segments.reduce((sum, segment) => sum + segment.durationSec, 0);
  const weightedSpeed = segments.reduce(
    (sum, segment) => sum + (segment.avgSpeed ?? 0) * segment.durationSec,
    0
  );
  const weightedPower = segments.reduce(
    (sum, segment) => sum + (segment.avgPower ?? 0) * segment.durationSec,
    0
  );
  const weightedHr = segments.reduce(
    (sum, segment) => sum + (segment.avgHr ?? 0) * segment.durationSec,
    0
  );
  const speedDuration = segments.reduce(
    (sum, segment) => sum + (segment.avgSpeed != null ? segment.durationSec : 0),
    0
  );
  const powerDuration = segments.reduce(
    (sum, segment) => sum + (segment.avgPower != null ? segment.durationSec : 0),
    0
  );
  const hrDuration = segments.reduce(
    (sum, segment) => sum + (segment.avgHr != null ? segment.durationSec : 0),
    0
  );

  const lastSegment = segments[segments.length - 1]!;
  const isBike = isBikeSport(activity.sport_type);

  payload[`${prefix}hr_mean`] = round1(hrDuration > 0 ? weightedHr / hrDuration : null);
  payload[`${prefix}hr_last`] = round1(lastSegment.avgHr ?? null);

  if (isBike) {
    payload[`${prefix}power_mean`] = round1(powerDuration > 0 ? weightedPower / powerDuration : null);
    payload[`${prefix}power_last`] = round1(lastSegment.avgPower ?? null);
    payload[`${prefix}pace_mean`] = null;
    payload[`${prefix}pace_last`] = null;
  } else {
    const meanSpeed = speedDuration > 0 ? weightedSpeed / speedDuration : null;
    payload[`${prefix}pace_mean`] = speedToPaceDecimal(meanSpeed);
    payload[`${prefix}pace_last`] = speedToPaceDecimal(lastSegment.avgSpeed ?? null);
    payload[`${prefix}power_mean`] = null;
    payload[`${prefix}power_last`] = null;
  }

  if (totalDuration <= 0) {
    payload[`${prefix}hr_mean`] = null;
    payload[`${prefix}power_mean`] = null;
    payload[`${prefix}pace_mean`] = null;
  }

  // Structure: count + median duration
  payload[`${prefix}count` as keyof ManualBlockOverridePayload] = segments.length;
  const sortedDurations = segments.map((s) => s.durationSec).sort((a, b) => a - b);
  const mid = Math.floor(sortedDurations.length / 2);
  const medianDuration =
    sortedDurations.length % 2 === 0
      ? (sortedDurations[mid - 1]! + sortedDurations[mid]!) / 2
      : sortedDurations[mid]!;
  payload[`${prefix}duration_sec` as keyof ManualBlockOverridePayload] = Math.round(medianDuration);

  return payload;
}

function resolveLegacyFromBlocks(
  activity: Activity,
  blockOverrides: Array<Partial<ManualBlockOverridePayload>>
) {
  const mergedActivity = { ...activity } as Activity & Partial<ManualBlockOverridePayload>;
  for (const override of blockOverrides) {
    Object.assign(mergedActivity, override);
  }

  const resolvedBlocks = ([1, 2, 3] as const)
    .map((blockIndex) => resolveBlockMetrics(mergedActivity as Activity, blockIndex))
    .filter((block) =>
      block.hrMean != null ||
      block.hrLast != null ||
      block.powerMean != null ||
      block.powerLast != null ||
      block.paceMean != null ||
      block.paceLast != null
    );

  if (resolvedBlocks.length === 0) {
    return {
      manual_interval_power_mean: null,
      manual_interval_power_last: null,
      manual_interval_hr_mean: null,
      manual_interval_hr_last: null,
      manual_interval_pace_mean: null,
      manual_interval_pace_last: null,
    };
  }

  const weights = resolvedBlocks.map((block) => {
    const durationWeight =
      (block.count ?? 1) * (block.representativeDurationSec ?? 0);
    if (durationWeight > 0) return durationWeight;
    if ((block.count ?? 0) > 0) return block.count!;
    return 1;
  });

  const sortedBlocks = [...resolvedBlocks].sort((a, b) => a.blockIndex - b.blockIndex);
  const lastBlock = sortedBlocks[sortedBlocks.length - 1]!;

  function weightedMean(
    values: Array<number | null>,
    localWeights: number[]
  ): number | null {
    let sum = 0;
    let total = 0;
    values.forEach((value, index) => {
      if (value == null) return;
      sum += value * localWeights[index]!;
      total += localWeights[index]!;
    });
    return total > 0 ? sum / total : null;
  }

  return {
    manual_interval_power_mean: round1(
      weightedMean(
        resolvedBlocks.map((block) => block.powerMean),
        weights
      )
    ),
    manual_interval_power_last: round1(lastBlock.powerLast),
    manual_interval_hr_mean: round1(
      weightedMean(
        resolvedBlocks.map((block) => block.hrMean),
        weights
      )
    ),
    manual_interval_hr_last: round1(lastBlock.hrLast),
    manual_interval_pace_mean: round2(
      weightedMean(
        resolvedBlocks.map((block) => block.paceMean),
        weights
      )
    ),
    manual_interval_pace_last: round2(lastBlock.paceLast),
  };
}

export function buildManualBlockPayload(
  activity: Activity,
  blockIndex: 1 | 2 | 3,
  segments: DetectedSegment[] | null
): ManualIntervalsUpdatePayload {
  const blockUpdate = buildBlockMetricUpdate(activity, blockIndex, segments);
  const legacy = resolveLegacyFromBlocks(activity, [blockUpdate]);
  const manualIntervalSegments = mergeManualSegmentBlocks(activity, blockIndex, segments);

  const overrides = { ...legacy } as ManualBlockOverridePayload;

  const SUFFIXES = [
    "power_mean", "power_last", "hr_mean", "hr_last",
    "pace_mean", "pace_last", "count", "duration_sec",
  ] as const;

  for (const bi of [1, 2, 3] as const) {
    const source = bi === blockIndex ? blockUpdate : activity;
    for (const suffix of SUFFIXES) {
      const key = `manual_interval_block_${bi}_${suffix}` as keyof ManualBlockOverridePayload;
      overrides[key] = ((source as Record<string, unknown>)[key] as number | null) ?? null;
    }
  }

  return {
    overrides,
    manual_interval_segments: manualIntervalSegments,
    reset_to_auto: manualIntervalSegments.length === 0,
  };
}

export function isBikeSport(sportType: string | null | undefined) {
  const normalized = (sportType ?? "").toLowerCase();
  return normalized === "velo" || normalized === "vtt" || normalized === "bike";
}
