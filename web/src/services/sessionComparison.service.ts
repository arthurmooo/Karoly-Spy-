import { normalizeSportKey } from "@/services/activity.service";
import { formatDistance, formatDuration, formatPaceDecimal, formatSwimPaceDecimal, speedToPace, speedToPaceDecimal, speedToSwimPace } from "@/services/format.service";
import type {
  Activity,
  ComparisonAlert,
  ComparisonDeltaRow,
  ComparisonRangeSelection,
  ComparisonSummary,
  FormAnalysis,
  StreamPoint,
} from "@/types/activity";

type SupportedComparisonSport = "CAP" | "VELO" | "NAT";
type MainMetricKind = "power" | "bike_speed" | "run_pace" | "swim_pace";

export interface SessionComparisonChartPoint {
  percent: number;
  currentMetric: number | null;
  referenceMetric: number | null;
  currentHr: number | null;
  referenceHr: number | null;
  currentAlt: number | null;
  referenceAlt: number | null;
  currentDistanceM: number;
  referenceDistanceM: number;
}

export interface SessionComparisonChartModel {
  metricKind: MainMetricKind;
  metricLabel: string;
  metricUnitLabel: string;
  reversed: boolean;
  data: SessionComparisonChartPoint[];
}

const POWER_COVERAGE_MIN_RATIO = 0.25;
const PRIMARY_METRIC_THRESHOLD = 5;
const HR_THRESHOLD = 3;
const DECOUPLING_THRESHOLD = 2;

interface MainMetricConfig {
  kind: MainMetricKind;
  label: string;
  unitLabel: string;
  reversed: boolean;
}

interface DistanceStreamPoint {
  distM: number;
  timeSec: number | null;
  speedMps: number | null;
  power: number | null;
  hr: number | null;
  mainMetric: number | null;
  alt: number | null;
}

interface ComparisonSegment {
  points: DistanceStreamPoint[];
  startM: number;
  endM: number;
  totalDistanceM: number;
  isFullRange: boolean;
}

interface SegmentSnapshot {
  distanceM: number | null;
  durationSec: number | null;
  avgHr: number | null;
  avgPower: number | null;
  avgSpeed: number | null;
  elevationGain: number | null;
  decoupling: number | null;
  rangeLabel: string;
  isFullRange: boolean;
}

function toSupportedSport(sportType: string | null | undefined): SupportedComparisonSport | null {
  const sport = normalizeSportKey(sportType ?? "");
  if (sport === "CAP" || sport === "VELO" || sport === "NAT") return sport;
  return null;
}

export function isComparisonSportSupported(sportType: string | null | undefined): boolean {
  return toSupportedSport(sportType) != null;
}

function getEffectiveDuration(activity: Pick<Activity, "moving_time_sec" | "duration_sec">): number | null {
  if (activity.moving_time_sec != null && activity.moving_time_sec > 0) return activity.moving_time_sec;
  if (activity.duration_sec != null && activity.duration_sec > 0) return activity.duration_sec;
  return null;
}

function getAverageSpeed(activity: Pick<Activity, "distance_m" | "moving_time_sec" | "duration_sec">): number | null {
  const duration = getEffectiveDuration(activity);
  if (!duration || !activity.distance_m || activity.distance_m <= 0) return null;
  return activity.distance_m / duration;
}

function formatSignedSeconds(deltaSeconds: number): string {
  const sign = deltaSeconds >= 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(deltaSeconds))}`;
}

function formatSignedNumber(value: number, fractionDigits = 1, suffix = ""): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}${suffix}`;
}

function hasUsablePower(activity: Activity): boolean {
  if (activity.avg_power != null && activity.avg_power > 0) return true;
  const streams = activity.activity_streams ?? [];
  if (!streams.length) return false;
  const poweredPoints = streams.filter((point) => point.pwr != null && point.pwr > 0).length;
  return poweredPoints / streams.length >= POWER_COVERAGE_MIN_RATIO;
}

function resolveMainMetric(current: Activity, reference: Activity): MainMetricConfig {
  const sport = toSupportedSport(current.sport_type);

  if (sport === "VELO") {
    if (hasUsablePower(current) && hasUsablePower(reference)) {
      return { kind: "power", label: "Puissance moyenne", unitLabel: "W", reversed: false };
    }
    return { kind: "bike_speed", label: "Vitesse moyenne", unitLabel: "km/h", reversed: false };
  }

  if (sport === "NAT") {
    return { kind: "swim_pace", label: "Allure moyenne", unitLabel: "/100m", reversed: true };
  }

  return { kind: "run_pace", label: "Allure moyenne", unitLabel: "/km", reversed: true };
}

function formatRangeValueKm(valueKm: number): string {
  return valueKm.toLocaleString("fr-FR", {
    minimumFractionDigits: valueKm >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function buildRangeLabel(startM: number, endM: number, totalM: number, isFullRange: boolean): string {
  if (totalM <= 0) return "Séance complète";

  const startKm = startM / 1000;
  const endKm = endM / 1000;
  const totalKm = totalM / 1000;

  if (isFullRange) {
    return `Séance complète · ${formatRangeValueKm(totalKm)} km`;
  }

  return `KM ${formatRangeValueKm(startKm)} à ${formatRangeValueKm(endKm)}`;
}

function formatMetricValue(value: number | null, config: MainMetricConfig): string {
  if (value == null) return "--";

  switch (config.kind) {
    case "power":
      return `${Math.round(value)} W`;
    case "bike_speed":
      return `${(value * 3.6).toFixed(1)} km/h`;
    case "run_pace":
      return speedToPace(value);
    case "swim_pace":
      return speedToSwimPace(value);
    default:
      return "--";
  }
}

function getPerformanceDeltaPct(currentRaw: number | null, referenceRaw: number | null): number | null {
  if (currentRaw == null || referenceRaw == null || referenceRaw <= 0) return null;
  return ((currentRaw - referenceRaw) / referenceRaw) * 100;
}

function getRowTrend(delta: number | null, lowerIsBetter = false, threshold = 0): "positive" | "negative" | "neutral" {
  if (delta == null) return "neutral";
  if (lowerIsBetter) {
    if (delta <= -threshold) return "positive";
    if (delta >= threshold) return "negative";
    return "neutral";
  }
  if (delta >= threshold) return "positive";
  if (delta <= -threshold) return "negative";
  return "neutral";
}

function buildAlert(
  performanceDeltaPct: number | null,
  hrDeltaPct: number | null,
  decouplingDelta: number | null,
  metricLabel: string,
  referenceDate: string
): ComparisonAlert {
  if (performanceDeltaPct == null || hrDeltaPct == null || decouplingDelta == null) {
    return { kind: "none", title: "", message: "" };
  }

  const performanceImproved = performanceDeltaPct >= PRIMARY_METRIC_THRESHOLD;
  const performanceRegressed = performanceDeltaPct <= -PRIMARY_METRIC_THRESHOLD;
  const hrDegraded = hrDeltaPct >= HR_THRESHOLD;
  const decDegraded = decouplingDelta >= DECOUPLING_THRESHOLD;
  const hrImprovedOrStable = hrDeltaPct < HR_THRESHOLD;
  const decImprovedOrStable = decouplingDelta < DECOUPLING_THRESHOLD;

  if (performanceImproved && hrImprovedOrStable && decImprovedOrStable) {
    return {
      kind: "progression",
      title: "Progression nette",
      message: `${metricLabel} en amélioration de ${performanceDeltaPct.toFixed(1)}% vs séance du ${referenceDate}, sans coût physiologique défavorable.`,
    };
  }

  if (performanceImproved && (hrDegraded || decDegraded)) {
    return {
      kind: "cout",
      title: "Progression avec coût",
      message: `${metricLabel} en amélioration de ${performanceDeltaPct.toFixed(1)}% vs séance du ${referenceDate}, mais avec un coût cardiaque ou de découplage plus élevé.`,
    };
  }

  if (performanceRegressed && (hrDegraded || decDegraded)) {
    return {
      kind: "regression",
      title: "Régression nette",
      message: `${metricLabel} en retrait de ${Math.abs(performanceDeltaPct).toFixed(1)}% vs séance du ${referenceDate}, avec une dérive physiologique également moins favorable.`,
    };
  }

  return { kind: "none", title: "", message: "" };
}

function sanitizeDistanceStreams(streams: StreamPoint[] | null | undefined, metric: MainMetricConfig): DistanceStreamPoint[] {
  if (!streams?.length) return [];

  const points = streams
    .filter(
      (point): point is StreamPoint & { dist_m: number } =>
        typeof point.dist_m === "number" && Number.isFinite(point.dist_m)
    )
    .map((point) => ({
      distM: point.dist_m,
      timeSec:
        point.elapsed_t != null && Number.isFinite(point.elapsed_t)
          ? point.elapsed_t
          : point.t != null && Number.isFinite(point.t)
          ? point.t
          : null,
      speedMps: point.spd != null && point.spd > 0 ? point.spd : null,
      power: point.pwr != null && point.pwr > 0 ? point.pwr : null,
      hr: point.hr != null && Number.isFinite(point.hr) ? point.hr : null,
      mainMetric:
        metric.kind === "power"
          ? point.pwr != null && point.pwr > 0 ? point.pwr : null
          : metric.kind === "bike_speed"
          ? point.spd != null && point.spd > 0 ? point.spd * 3.6 : null
          : metric.kind === "run_pace"
          ? point.spd != null && point.spd > 0 ? speedToPaceDecimal(point.spd) : null
          : point.spd != null && point.spd > 0 ? 100 / point.spd / 60 : null,
      alt: point.alt != null && Number.isFinite(point.alt) ? point.alt : null,
    }))
    .sort((left, right) => left.distM - right.distM);

  if (points.length < 2) return [];

  const baseDistance = points[0]?.distM ?? 0;
  const normalizedPoints: DistanceStreamPoint[] = [];
  let previousDistance = -1;

  for (const point of points) {
    const normalizedDistance = Math.max(0, point.distM - baseDistance);
    if (normalizedDistance < previousDistance) continue;
    previousDistance = normalizedDistance;
    normalizedPoints.push({ ...point, distM: normalizedDistance });
  }

  return normalizedPoints;
}

function normalizeComparisonRange(
  totalDistanceM: number,
  range: ComparisonRangeSelection | null | undefined
): { startM: number; endM: number; isFullRange: boolean } {
  if (totalDistanceM <= 0) {
    return { startM: 0, endM: 0, isFullRange: true };
  }

  const requestedStartM = Math.max(0, (range?.startKm ?? 0) * 1000);
  const requestedEndM = Math.max(0, (range?.endKm ?? totalDistanceM / 1000) * 1000);
  const safeStart = Math.min(requestedStartM, totalDistanceM);
  const safeEnd = Math.min(Math.max(requestedEndM, safeStart), totalDistanceM);
  const minRangeM = Math.min(100, totalDistanceM);
  const adjustedEnd = safeEnd - safeStart < minRangeM ? Math.min(totalDistanceM, safeStart + minRangeM) : safeEnd;
  const adjustedStart = adjustedEnd - safeStart < minRangeM ? Math.max(0, adjustedEnd - minRangeM) : safeStart;

  return {
    startM: adjustedStart,
    endM: adjustedEnd,
    isFullRange: adjustedStart <= 1 && adjustedEnd >= totalDistanceM - 1,
  };
}

function interpolateAtDistance(points: DistanceStreamPoint[], targetDistM: number): DistanceStreamPoint | null {
  if (!points.length) return null;
  if (targetDistM <= points[0]!.distM) return points[0]!;
  const lastPoint = points[points.length - 1]!;
  if (targetDistM >= lastPoint.distM) return lastPoint;

  let index = 1;
  while (index < points.length && points[index]!.distM < targetDistM) {
    index += 1;
  }

  const right = points[index]!;
  const left = points[index - 1]!;
  const span = right.distM - left.distM;
  if (span <= 0) return right;
  const ratio = (targetDistM - left.distM) / span;

  const interpolate = (start: number | null, end: number | null): number | null => {
    if (start == null || end == null) return null;
    return start + (end - start) * ratio;
  };

  return {
    distM: targetDistM,
    timeSec: interpolate(left.timeSec, right.timeSec),
    speedMps: interpolate(left.speedMps, right.speedMps),
    power: interpolate(left.power, right.power),
    hr: interpolate(left.hr, right.hr),
    mainMetric: interpolate(left.mainMetric, right.mainMetric),
    alt: interpolate(left.alt, right.alt),
  };
}

function extractSegment(
  points: DistanceStreamPoint[],
  range: ComparisonRangeSelection | null | undefined
): ComparisonSegment | null {
  if (points.length < 2) return null;

  const totalDistanceM = points[points.length - 1]!.distM;
  const { startM, endM, isFullRange } = normalizeComparisonRange(totalDistanceM, range);
  if (endM <= startM) return null;

  const startPoint = interpolateAtDistance(points, startM);
  const endPoint = interpolateAtDistance(points, endM);
  if (!startPoint || !endPoint) return null;

  const innerPoints = points
    .filter((point) => point.distM > startM && point.distM < endM)
    .map((point) => ({ ...point, distM: point.distM - startM }));

  return {
    points: [
      { ...startPoint, distM: 0 },
      ...innerPoints,
      { ...endPoint, distM: endM - startM },
    ],
    startM,
    endM,
    totalDistanceM,
    isFullRange,
  };
}

function averageFromValues(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function computeWeightedAverage(
  points: DistanceStreamPoint[],
  accessor: (point: DistanceStreamPoint) => number | null
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (previous.timeSec == null || current.timeSec == null) continue;

    const weight = current.timeSec - previous.timeSec;
    if (weight <= 0) continue;

    const previousValue = accessor(previous);
    const currentValue = accessor(current);
    if (previousValue == null && currentValue == null) continue;

    const averagedValue =
      previousValue != null && currentValue != null
        ? (previousValue + currentValue) / 2
        : previousValue ?? currentValue ?? null;

    if (averagedValue == null) continue;

    weightedSum += averagedValue * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) return weightedSum / totalWeight;
  return averageFromValues(points.map(accessor));
}

function computeDurationFromSegment(points: DistanceStreamPoint[]): number | null {
  const startTime = points[0]?.timeSec;
  const endTime = points[points.length - 1]?.timeSec;
  if (startTime == null || endTime == null || endTime <= startTime) return null;
  return endTime - startTime;
}

function computeElevationGain(points: DistanceStreamPoint[]): number | null {
  let gain = 0;
  let hasAltitude = false;

  for (let index = 1; index < points.length; index += 1) {
    const previousAlt = points[index - 1]!.alt;
    const currentAlt = points[index]!.alt;
    if (previousAlt == null || currentAlt == null) continue;

    hasAltitude = true;
    if (currentAlt > previousAlt) {
      gain += currentAlt - previousAlt;
    }
  }

  return hasAltitude ? gain : null;
}

function computeSegmentDecoupling(segment: ComparisonSegment, metric: MainMetricConfig): number | null {
  if (segment.points.length < 4) return null;

  const absolutePoints = segment.points.map((point) => ({
    ...point,
    distM: point.distM + segment.startM,
  }));
  const midM = segment.startM + (segment.endM - segment.startM) / 2;
  const firstHalf = extractSegment(absolutePoints, { startKm: segment.startM / 1000, endKm: midM / 1000 });
  const secondHalf = extractSegment(absolutePoints, { startKm: midM / 1000, endKm: segment.endM / 1000 });

  if (!firstHalf || !secondHalf) return null;

  const firstHr = computeWeightedAverage(firstHalf.points, (point) => point.hr);
  const secondHr = computeWeightedAverage(secondHalf.points, (point) => point.hr);
  if (firstHr == null || secondHr == null || firstHr <= 0 || secondHr <= 0) return null;

  const firstOutput =
    metric.kind === "power"
      ? computeWeightedAverage(firstHalf.points, (point) => point.power)
      : (() => {
          const duration = computeDurationFromSegment(firstHalf.points);
          return duration != null && duration > 0 ? (firstHalf.endM - firstHalf.startM) / duration : null;
        })();
  const secondOutput =
    metric.kind === "power"
      ? computeWeightedAverage(secondHalf.points, (point) => point.power)
      : (() => {
          const duration = computeDurationFromSegment(secondHalf.points);
          return duration != null && duration > 0 ? (secondHalf.endM - secondHalf.startM) / duration : null;
        })();

  if (firstOutput == null || secondOutput == null || firstOutput <= 0 || secondOutput <= 0) return null;

  const firstEfficiency = firstOutput / firstHr;
  const secondEfficiency = secondOutput / secondHr;
  if (firstEfficiency <= 0 || secondEfficiency <= 0) return null;

  return ((firstEfficiency - secondEfficiency) / firstEfficiency) * 100;
}

function buildSegmentSnapshot(
  activity: Activity,
  metric: MainMetricConfig,
  range: ComparisonRangeSelection | null | undefined
): SegmentSnapshot {
  const points = sanitizeDistanceStreams(activity.activity_streams, metric);
  const totalDistanceM = points[points.length - 1]?.distM ?? activity.distance_m ?? 0;
  const normalizedRange = normalizeComparisonRange(totalDistanceM, range);
  const segment = extractSegment(points, range);

  if (!segment) {
    return {
      distanceM: activity.distance_m ?? null,
      durationSec: getEffectiveDuration(activity),
      avgHr: activity.avg_hr ?? null,
      avgPower: activity.avg_power ?? null,
      avgSpeed: getAverageSpeed(activity),
      elevationGain: activity.elevation_gain ?? null,
      decoupling: activity.decoupling_index ?? null,
      rangeLabel: buildRangeLabel(
        normalizedRange.startM,
        normalizedRange.endM,
        totalDistanceM,
        normalizedRange.isFullRange
      ),
      isFullRange: normalizedRange.isFullRange,
    };
  }

  const durationSec = computeDurationFromSegment(segment.points);
  const distanceM = segment.endM - segment.startM;

  return {
    distanceM,
    durationSec,
    avgHr: computeWeightedAverage(segment.points, (point) => point.hr),
    avgPower: computeWeightedAverage(segment.points, (point) => point.power),
    avgSpeed: durationSec != null && durationSec > 0 ? distanceM / durationSec : null,
    elevationGain: computeElevationGain(segment.points),
    decoupling: computeSegmentDecoupling(segment, metric),
    rangeLabel: buildRangeLabel(segment.startM, segment.endM, segment.totalDistanceM, segment.isFullRange),
    isFullRange: segment.isFullRange,
  };
}

export function buildComparisonSummary(
  current: Activity,
  reference: Activity,
  currentRange?: ComparisonRangeSelection | null,
  referenceRange?: ComparisonRangeSelection | null
): ComparisonSummary {
  const mainMetric = resolveMainMetric(current, reference);
  const currentSegment = buildSegmentSnapshot(current, mainMetric, currentRange);
  const referenceSegment = buildSegmentSnapshot(reference, mainMetric, referenceRange);
  const currentMetricRaw = mainMetric.kind === "power" ? currentSegment.avgPower : currentSegment.avgSpeed;
  const referenceMetricRaw = mainMetric.kind === "power" ? referenceSegment.avgPower : referenceSegment.avgSpeed;
  const performanceDeltaPct = getPerformanceDeltaPct(currentMetricRaw, referenceMetricRaw);
  const hrDeltaPct =
    currentSegment.avgHr != null && referenceSegment.avgHr != null && referenceSegment.avgHr > 0
      ? ((currentSegment.avgHr - referenceSegment.avgHr) / referenceSegment.avgHr) * 100
      : null;
  const decouplingDelta =
    currentSegment.decoupling != null && referenceSegment.decoupling != null
      ? currentSegment.decoupling - referenceSegment.decoupling
      : null;
  const referenceDate = new Date(reference.session_date).toLocaleDateString("fr-FR");
  const isSegmentComparison = !currentSegment.isFullRange || !referenceSegment.isFullRange;

  const rows: ComparisonDeltaRow[] = [
    {
      key: "volume",
      label: isSegmentComparison ? "Distance segment" : "Volume",
      currentValue: currentSegment.distanceM != null ? formatDistance(currentSegment.distanceM) : "--",
      referenceValue: referenceSegment.distanceM != null ? formatDistance(referenceSegment.distanceM) : "--",
      deltaValue:
        currentSegment.distanceM != null && referenceSegment.distanceM != null
          ? formatSignedNumber((currentSegment.distanceM - referenceSegment.distanceM) / 1000, 1, " km")
          : "--",
      trend: "neutral",
    },
    {
      key: "duration",
      label: isSegmentComparison ? "Durée segment" : "Durée",
      currentValue: currentSegment.durationSec != null ? formatDuration(currentSegment.durationSec) : "--",
      referenceValue: referenceSegment.durationSec != null ? formatDuration(referenceSegment.durationSec) : "--",
      deltaValue:
        currentSegment.durationSec != null && referenceSegment.durationSec != null
          ? formatSignedSeconds(currentSegment.durationSec - referenceSegment.durationSec)
          : "--",
      trend: "neutral",
    },
    {
      key: "main_metric",
      label: mainMetric.label,
      currentValue: formatMetricValue(currentMetricRaw, mainMetric),
      referenceValue: formatMetricValue(referenceMetricRaw, mainMetric),
      deltaValue: performanceDeltaPct != null ? formatSignedNumber(performanceDeltaPct, 1, "%") : "--",
      trend: getRowTrend(performanceDeltaPct, false, PRIMARY_METRIC_THRESHOLD),
    },
    {
      key: "hr",
      label: "FC moyenne",
      currentValue: currentSegment.avgHr != null ? `${Math.round(currentSegment.avgHr)} bpm` : "--",
      referenceValue: referenceSegment.avgHr != null ? `${Math.round(referenceSegment.avgHr)} bpm` : "--",
      deltaValue:
        currentSegment.avgHr != null && referenceSegment.avgHr != null
          ? formatSignedNumber(currentSegment.avgHr - referenceSegment.avgHr, 0, " bpm")
          : "--",
      trend: getRowTrend(hrDeltaPct, true, HR_THRESHOLD),
    },
    {
      key: "decoupling",
      label: isSegmentComparison ? "Découplage segment" : "Découplage",
      currentValue: currentSegment.decoupling != null ? `${currentSegment.decoupling.toFixed(1)}%` : "--",
      referenceValue: referenceSegment.decoupling != null ? `${referenceSegment.decoupling.toFixed(1)}%` : "--",
      deltaValue: decouplingDelta != null ? formatSignedNumber(decouplingDelta, 1, " pts") : "--",
      trend: getRowTrend(decouplingDelta, true, DECOUPLING_THRESHOLD),
    },
    {
      key: "temperature",
      label: "Température",
      currentValue: current.temp_avg != null ? `${current.temp_avg.toFixed(1)} °C` : "--",
      referenceValue: reference.temp_avg != null ? `${reference.temp_avg.toFixed(1)} °C` : "--",
      deltaValue:
        current.temp_avg != null && reference.temp_avg != null
          ? formatSignedNumber(current.temp_avg - reference.temp_avg, 1, " °C")
          : "--",
      trend: "neutral",
    },
    {
      key: "elevation",
      label: isSegmentComparison ? "D+ segment" : "D+",
      currentValue: currentSegment.elevationGain != null ? `${Math.round(currentSegment.elevationGain)} m` : "--",
      referenceValue: referenceSegment.elevationGain != null ? `${Math.round(referenceSegment.elevationGain)} m` : "--",
      deltaValue:
        currentSegment.elevationGain != null && referenceSegment.elevationGain != null
          ? formatSignedNumber(currentSegment.elevationGain - referenceSegment.elevationGain, 0, " m")
          : "--",
      trend: "neutral",
    },
  ];

  return {
    metricLabel: mainMetric.label,
    metricUnitLabel: mainMetric.unitLabel,
    rows,
    alert: buildAlert(performanceDeltaPct, hrDeltaPct, decouplingDelta, mainMetric.label, referenceDate),
    isSegmentComparison,
    currentRangeLabel: currentSegment.rangeLabel,
    referenceRangeLabel: referenceSegment.rangeLabel,
  };
}

export function buildComparisonChartModel(
  current: Activity,
  reference: Activity,
  currentRange?: ComparisonRangeSelection | null,
  referenceRange?: ComparisonRangeSelection | null
): SessionComparisonChartModel | null {
  const metric = resolveMainMetric(current, reference);
  const currentSegment = extractSegment(sanitizeDistanceStreams(current.activity_streams, metric), currentRange);
  const referenceSegment = extractSegment(sanitizeDistanceStreams(reference.activity_streams, metric), referenceRange);

  if (!currentSegment || !referenceSegment) return null;

  const currentPoints = currentSegment.points;
  const referencePoints = referenceSegment.points;
  const currentTotal = currentPoints[currentPoints.length - 1]!.distM;
  const referenceTotal = referencePoints[referencePoints.length - 1]!.distM;
  if (currentTotal <= 0 || referenceTotal <= 0) return null;

  const data: SessionComparisonChartPoint[] = [];

  for (let percent = 0; percent <= 100; percent += 1) {
    const currentTarget = (currentTotal * percent) / 100;
    const referenceTarget = (referenceTotal * percent) / 100;
    const currentInterpolated = interpolateAtDistance(currentPoints, currentTarget);
    const referenceInterpolated = interpolateAtDistance(referencePoints, referenceTarget);

    data.push({
      percent,
      currentMetric: currentInterpolated?.mainMetric ?? null,
      referenceMetric: referenceInterpolated?.mainMetric ?? null,
      currentHr: currentInterpolated?.hr ?? null,
      referenceHr: referenceInterpolated?.hr ?? null,
      currentAlt: currentInterpolated?.alt ?? null,
      referenceAlt: referenceInterpolated?.alt ?? null,
      currentDistanceM: currentSegment.startM + currentTarget,
      referenceDistanceM: referenceSegment.startM + referenceTarget,
    });
  }

  return {
    metricKind: metric.kind,
    metricLabel: metric.label,
    metricUnitLabel: metric.unitLabel,
    reversed: metric.reversed,
    data,
  };
}

export interface FormAnalysisKpi {
  label: string;
  value: string;
  delta: string;
  invert: boolean;
  tooltip: string;
}

export interface FormAnalysisSummary {
  decision: string;
  comparableCount: number;
  comparisonMode: string | null;
  templateKey: string | null;
  kpis: FormAnalysisKpi[];
  tempInfo: string | null;
}

function fmtVal(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function fmtPctVal(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function buildFormAnalysisSummary(fa: FormAnalysis): FormAnalysisSummary | null {
  const comparableCount = fa.comparable_count ?? 0;
  const decision = fa.decision?.final ?? fa.decision?.module ?? fa.decision?.global ?? "unknown";

  const kpis: FormAnalysisKpi[] = [
    {
      label: "Eff. Aérobie",
      value: fmtVal(fa.ea?.today, 3),
      delta: fa.ea?.delta_pct != null ? fmtPctVal(fa.ea.delta_pct) : "—",
      invert: false,
      tooltip: "Rapport output ÷ FC. Plus c'est haut, meilleure est la forme.",
    },
    {
      label: fa.decoupling?.metric === "dec_int_pct" ? "Déc. int." : "Découplage",
      value: fa.decoupling?.today != null ? fmtPctVal(fa.decoupling.today) : "—",
      delta: fa.decoupling?.delta != null ? `Δ ${fmtPctVal(fa.decoupling.delta)}` : "—",
      invert: true,
      tooltip: "Dérive de la FC à allure constante (%). Proche de 0% = bonne endurance.",
    },
    {
      label: "FC corrigée",
      value: fmtVal(fa.temperature?.hr_corr, 1, " bpm"),
      delta: fa.temperature?.delta_hr_corr != null ? `Δ ${fmtVal(fa.temperature.delta_hr_corr, 1)} bpm` : "—",
      invert: true,
      tooltip: "FC ajustée pour la température. Permet de comparer les séances.",
    },
    {
      label: "RPE",
      value: fmtVal(fa.rpe?.today, 1),
      delta: fa.rpe?.delta != null ? `Δ ${fmtVal(fa.rpe.delta, 1)}` : "—",
      invert: true,
      tooltip: "Effort ressenti par l'athlète (1-10). Compare à la moyenne historique.",
    },
    {
      label: "Allure",
      value: fmtVal(fa.output?.mean, 1, fa.output?.unit ? ` ${fa.output.unit}` : ""),
      delta: fa.output?.delta_pct != null ? fmtPctVal(fa.output.delta_pct) : "—",
      invert: false,
      tooltip: "Allure ou puissance moyenne sur le segment analysé.",
    },
  ];

  let tempInfo: string | null = null;
  if (fa.temperature?.tref != null) {
    tempInfo = `Tref ${fmtVal(fa.temperature.tref, 1)}°C`;
    if (fa.temperature.beta_hr != null) {
      tempInfo += ` · β ${fmtVal(fa.temperature.beta_hr, 3)} bpm/°C`;
    }
  }

  return {
    decision,
    comparableCount,
    comparisonMode: fa.comparison_mode ?? null,
    templateKey: fa.template_key ?? null,
    kpis,
    tempInfo,
  };
}

export function formatComparisonTooltipMetric(value: number | null, metricKind: MainMetricKind): string {
  if (value == null) return "--";
  if (metricKind === "power") return `${Math.round(value)} W`;
  if (metricKind === "bike_speed") return `${value.toFixed(1)} km/h`;
  if (metricKind === "run_pace") return formatPaceDecimal(value);
  return formatSwimPaceDecimal(value);
}
