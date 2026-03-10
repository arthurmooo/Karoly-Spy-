import type { Activity, IntervalBlock, StreamPoint } from "@/types/activity";

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
  manual_interval_block_2_power_mean: number | null;
  manual_interval_block_2_power_last: number | null;
  manual_interval_block_2_hr_mean: number | null;
  manual_interval_block_2_hr_last: number | null;
  manual_interval_block_2_pace_mean: number | null;
  manual_interval_block_2_pace_last: number | null;
}

interface DetectionOptions {
  streams: StreamPoint[];
  mode: ManualDetectionMode;
  metric: ManualDetectionMetric;
  repetitions: number;
  targetDurationSec?: number;
  targetDistanceM?: number;
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
  blockIndex: 1 | 2;
  count: number | null;
  representativeDurationSec: number | null;
  paceMean: number | null;
  paceLast: number | null;
  powerMean: number | null;
  powerLast: number | null;
  hrMean: number | null;
  hrLast: number | null;
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

function rangesOverlap(a: DetectedSegment, b: DetectedSegment): boolean {
  return a.startSec < b.endSec && a.endSec > b.startSec;
}

export function detectBestSegments(options: DetectionOptions): DetectedSegment[] {
  const { streams, mode, metric, repetitions, targetDurationSec, targetDistanceM } = options;
  const targetValue = mode === "duration" ? targetDurationSec : targetDistanceM;

  if (!streams.length || !targetValue || repetitions <= 0) return [];

  const samples = prepareSamples(streams);
  const candidates: DetectedSegment[] = [];

  for (let i = 0; i < samples.length; i += 1) {
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

  candidates.sort((a, b) => {
    if (b.avgValue !== a.avgValue) return b.avgValue - a.avgValue;
    return a.startSec - b.startSec;
  });

  const selected: DetectedSegment[] = [];
  for (const candidate of candidates) {
    if (selected.length >= repetitions) break;
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
  blockIndex: 1 | 2
): ResolvedBlockMetrics {
  const baseBlock = activity.segmented_metrics?.interval_blocks?.[blockIndex - 1];
  const prefix = `manual_interval_block_${blockIndex}_` as const;

  const paceMean = activity[`${prefix}pace_mean`] ?? baseBlock?.interval_pace_mean ?? null;
  const paceLast = activity[`${prefix}pace_last`] ?? baseBlock?.interval_pace_last ?? null;
  const powerMean = activity[`${prefix}power_mean`] ?? baseBlock?.interval_power_mean ?? null;
  const powerLast = activity[`${prefix}power_last`] ?? baseBlock?.interval_power_last ?? null;
  const hrMean = activity[`${prefix}hr_mean`] ?? baseBlock?.interval_hr_mean ?? null;
  const hrLast = activity[`${prefix}hr_last`] ?? baseBlock?.interval_hr_last ?? null;

  return {
    blockIndex,
    count: baseBlock?.count ?? null,
    representativeDurationSec:
      baseBlock?.representative_duration_sec ?? baseBlock?.total_duration_sec ?? null,
    paceMean,
    paceLast,
    powerMean,
    powerLast,
    hrMean,
    hrLast,
  };
}

export function hasManualBlockOverride(activity: Activity, blockIndex: 1 | 2): boolean {
  const prefix = `manual_interval_block_${blockIndex}_` as const;
  return (
    activity[`${prefix}pace_mean`] != null ||
    activity[`${prefix}pace_last`] != null ||
    activity[`${prefix}power_mean`] != null ||
    activity[`${prefix}power_last`] != null ||
    activity[`${prefix}hr_mean`] != null ||
    activity[`${prefix}hr_last`] != null
  );
}

function buildBlockMetricUpdate(
  activity: Activity,
  blockIndex: 1 | 2,
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
    payload[`${prefix}pace_mean`] = round2(speedToPaceDecimal(meanSpeed));
    payload[`${prefix}pace_last`] = round2(speedToPaceDecimal(lastSegment.avgSpeed ?? null));
    payload[`${prefix}power_mean`] = null;
    payload[`${prefix}power_last`] = null;
  }

  if (totalDuration <= 0) {
    payload[`${prefix}hr_mean`] = null;
    payload[`${prefix}power_mean`] = null;
    payload[`${prefix}pace_mean`] = null;
  }

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

  const resolvedBlocks = ([1, 2] as const)
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
  blockIndex: 1 | 2,
  segments: DetectedSegment[] | null
): ManualBlockOverridePayload {
  const blockUpdate = buildBlockMetricUpdate(activity, blockIndex, segments);
  const legacy = resolveLegacyFromBlocks(activity, [blockUpdate]);
  return {
    manual_interval_power_mean: legacy.manual_interval_power_mean,
    manual_interval_power_last: legacy.manual_interval_power_last,
    manual_interval_hr_mean: legacy.manual_interval_hr_mean,
    manual_interval_hr_last: legacy.manual_interval_hr_last,
    manual_interval_pace_mean: legacy.manual_interval_pace_mean,
    manual_interval_pace_last: legacy.manual_interval_pace_last,
    manual_interval_block_1_power_mean:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_power_mean ?? null
        : activity.manual_interval_block_1_power_mean ?? null,
    manual_interval_block_1_power_last:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_power_last ?? null
        : activity.manual_interval_block_1_power_last ?? null,
    manual_interval_block_1_hr_mean:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_hr_mean ?? null
        : activity.manual_interval_block_1_hr_mean ?? null,
    manual_interval_block_1_hr_last:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_hr_last ?? null
        : activity.manual_interval_block_1_hr_last ?? null,
    manual_interval_block_1_pace_mean:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_pace_mean ?? null
        : activity.manual_interval_block_1_pace_mean ?? null,
    manual_interval_block_1_pace_last:
      blockIndex === 1
        ? blockUpdate.manual_interval_block_1_pace_last ?? null
        : activity.manual_interval_block_1_pace_last ?? null,
    manual_interval_block_2_power_mean:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_power_mean ?? null
        : activity.manual_interval_block_2_power_mean ?? null,
    manual_interval_block_2_power_last:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_power_last ?? null
        : activity.manual_interval_block_2_power_last ?? null,
    manual_interval_block_2_hr_mean:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_hr_mean ?? null
        : activity.manual_interval_block_2_hr_mean ?? null,
    manual_interval_block_2_hr_last:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_hr_last ?? null
        : activity.manual_interval_block_2_hr_last ?? null,
    manual_interval_block_2_pace_mean:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_pace_mean ?? null
        : activity.manual_interval_block_2_pace_mean ?? null,
    manual_interval_block_2_pace_last:
      blockIndex === 2
        ? blockUpdate.manual_interval_block_2_pace_last ?? null
        : activity.manual_interval_block_2_pace_last ?? null,
  };
}

export function isBikeSport(sportType: string | null | undefined) {
  const normalized = (sportType ?? "").toLowerCase();
  return normalized === "velo" || normalized === "vtt" || normalized === "bike";
}
