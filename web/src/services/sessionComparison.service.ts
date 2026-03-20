import { normalizeSportKey } from "@/services/activity.service";
import { formatDistance, formatDuration, formatPaceDecimal, speedToPace, speedToPaceDecimal } from "@/services/format.service";
import type {
  Activity,
  ComparisonAlert,
  ComparisonDeltaRow,
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
  hr: number | null;
  mainMetric: number | null;
  alt: number | null;
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

function speedToSwimPace(ms: number): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 100 / ms;
  let min = Math.floor(paceSec / 60);
  let sec = Math.round(paceSec % 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /100m`;
}

function formatSwimPaceDecimal(minPer100m: number): string {
  let min = Math.floor(minPer100m);
  let sec = Math.round((minPer100m - min) * 60);
  if (sec === 60) { min += 1; sec = 0; }
  return `${min}'${sec.toString().padStart(2, "0")} /100m`;
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

function getMetricRawValue(activity: Activity, config: MainMetricConfig): number | null {
  switch (config.kind) {
    case "power":
      return activity.avg_power != null && activity.avg_power > 0 ? activity.avg_power : null;
    case "bike_speed":
    case "run_pace":
    case "swim_pace":
      return getAverageSpeed(activity);
    default:
      return null;
  }
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

function getHrDeltaPct(current: Activity, reference: Activity): number | null {
  if (current.avg_hr == null || reference.avg_hr == null || reference.avg_hr <= 0) return null;
  return ((current.avg_hr - reference.avg_hr) / reference.avg_hr) * 100;
}

function getDecouplingDelta(current: Activity, reference: Activity): number | null {
  if (current.decoupling_index == null || reference.decoupling_index == null) return null;
  return current.decoupling_index - reference.decoupling_index;
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

export function buildComparisonSummary(current: Activity, reference: Activity): ComparisonSummary {
  const mainMetric = resolveMainMetric(current, reference);
  const currentMetricRaw = getMetricRawValue(current, mainMetric);
  const referenceMetricRaw = getMetricRawValue(reference, mainMetric);
  const performanceDeltaPct = getPerformanceDeltaPct(currentMetricRaw, referenceMetricRaw);
  const hrDeltaPct = getHrDeltaPct(current, reference);
  const decouplingDelta = getDecouplingDelta(current, reference);
  const currentDuration = getEffectiveDuration(current);
  const referenceDuration = getEffectiveDuration(reference);
  const referenceDate = new Date(reference.session_date).toLocaleDateString("fr-FR");

  const rows: ComparisonDeltaRow[] = [
    {
      key: "volume",
      label: "Volume",
      currentValue: current.distance_m != null ? formatDistance(current.distance_m) : "--",
      referenceValue: reference.distance_m != null ? formatDistance(reference.distance_m) : "--",
      deltaValue:
        current.distance_m != null && reference.distance_m != null
          ? formatSignedNumber((current.distance_m - reference.distance_m) / 1000, 1, " km")
          : "--",
      trend: "neutral",
    },
    {
      key: "duration",
      label: "Durée",
      currentValue: currentDuration != null ? formatDuration(currentDuration) : "--",
      referenceValue: referenceDuration != null ? formatDuration(referenceDuration) : "--",
      deltaValue:
        currentDuration != null && referenceDuration != null
          ? formatSignedSeconds(currentDuration - referenceDuration)
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
      currentValue: current.avg_hr != null ? `${Math.round(current.avg_hr)} bpm` : "--",
      referenceValue: reference.avg_hr != null ? `${Math.round(reference.avg_hr)} bpm` : "--",
      deltaValue:
        current.avg_hr != null && reference.avg_hr != null
          ? formatSignedNumber(current.avg_hr - reference.avg_hr, 0, " bpm")
          : "--",
      trend: getRowTrend(hrDeltaPct, true, HR_THRESHOLD),
    },
    {
      key: "decoupling",
      label: "Découplage",
      currentValue: current.decoupling_index != null ? `${current.decoupling_index.toFixed(1)}%` : "--",
      referenceValue: reference.decoupling_index != null ? `${reference.decoupling_index.toFixed(1)}%` : "--",
      deltaValue: decouplingDelta != null ? formatSignedNumber(decouplingDelta, 1, " pts") : "--",
      trend: getRowTrend(decouplingDelta, true, DECOUPLING_THRESHOLD),
    },
  ];

  return {
    metricLabel: mainMetric.label,
    metricUnitLabel: mainMetric.unitLabel,
    rows,
    alert: buildAlert(performanceDeltaPct, hrDeltaPct, decouplingDelta, mainMetric.label, referenceDate),
  };
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
    hr: interpolate(left.hr, right.hr),
    mainMetric: interpolate(left.mainMetric, right.mainMetric),
    alt: interpolate(left.alt, right.alt),
  };
}

export function buildComparisonChartModel(
  current: Activity,
  reference: Activity
): SessionComparisonChartModel | null {
  const metric = resolveMainMetric(current, reference);
  const currentPoints = sanitizeDistanceStreams(current.activity_streams, metric);
  const referencePoints = sanitizeDistanceStreams(reference.activity_streams, metric);

  if (currentPoints.length < 2 || referencePoints.length < 2) return null;

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
      currentDistanceM: currentTarget,
      referenceDistanceM: referenceTarget,
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
      label: "EA",
      value: fmtVal(fa.ea?.today, 3),
      delta: fa.ea?.delta_pct != null ? fmtPctVal(fa.ea.delta_pct) : "—",
      invert: false,
    },
    {
      label: fa.decoupling?.metric === "dec_int_pct" ? "Dec int" : "Dec",
      value: fa.decoupling?.today != null ? fmtPctVal(fa.decoupling.today) : "—",
      delta: fa.decoupling?.delta != null ? `Δ ${fmtPctVal(fa.decoupling.delta)}` : "—",
      invert: true,
    },
    {
      label: "HRcorr",
      value: fmtVal(fa.temperature?.hr_corr, 1, " bpm"),
      delta: fa.temperature?.delta_hr_corr != null ? `Δ ${fmtVal(fa.temperature.delta_hr_corr, 1)} bpm` : "—",
      invert: true,
    },
    {
      label: "RPE",
      value: fmtVal(fa.rpe?.today, 1),
      delta: fa.rpe?.delta != null ? `Δ ${fmtVal(fa.rpe.delta, 1)}` : "—",
      invert: true,
    },
    {
      label: "Output",
      value: fmtVal(fa.output?.mean, 1, fa.output?.unit ? ` ${fa.output.unit}` : ""),
      delta: fa.output?.delta_pct != null ? fmtPctVal(fa.output.delta_pct) : "—",
      invert: false,
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
