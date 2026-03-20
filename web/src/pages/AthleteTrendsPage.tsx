import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { AthleteSubNav } from "@/components/layout/AthleteSubNav";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { useReadiness } from "@/hooks/useReadiness";
import { getAthleteById } from "@/repositories/athlete.repository";
import {
  SWC_BASELINE_DAYS,
  buildHrvTimeline,
  getLatestContextPoint,
  getLatestSignalPoint,
  type DerivedHrvPoint,
} from "@/services/hrv.service";
import type { Athlete } from "@/types/athlete";

type JournalSortBy = "date" | "sleep" | "energy" | "fatigue" | "lifestyle" | "sickness" | "alcohol";
type TrendsPeriod = "7d" | "1m" | "3m" | "1y";
type PrimarySeriesKey =
  | "ln_rmssd_7d_avg"
  | "swc_band"
  | "ln_rmssd"
  | "rmssd"
  | "resting_hr"
  | "resting_hr_30d_avg";
type ScoreSeriesKey =
  | "sleep_quality"
  | "mental_energy"
  | "fatigue"
  | "lifestyle"
  | "muscle_soreness"
  | "physical_condition"
  | "training_performance"
  | "training_rpe"
  | "recovery_points";
type PrimaryAxisId = "ln" | "rmssd" | "hr";

interface PeriodOption {
  key: TrendsPeriod;
  label: string;
  days: number;
}

interface PrimarySeriesConfig {
  key: Exclude<PrimarySeriesKey, "swc_band">;
  label: string;
  axis: PrimaryAxisId;
  color: string;
  unit: string;
  dashed?: boolean;
  accessor: (point: DerivedHrvPoint) => number | null;
}

interface ScoreSeriesConfig {
  key: ScoreSeriesKey;
  label: string;
  color: string;
  accessor: (point: DerivedHrvPoint) => number | null;
}

interface PrimaryChartRow {
  timestamp: number;
  ln_rmssd_7d_avg: number | null;
  ln_rmssd: number | null;
  swc_low_28d: number | null;
  swc_high_28d: number | null;
  rmssd: number | null;
  resting_hr: number | null;
  resting_hr_30d_avg: number | null;
}

interface ScoreChartRow {
  timestamp: number;
  sleep_quality: number | null;
  mental_energy: number | null;
  fatigue: number | null;
  lifestyle: number | null;
  muscle_soreness: number | null;
  physical_condition: number | null;
  training_performance: number | null;
  training_rpe: number | null;
  recovery_points: number | null;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "7d", label: "7j", days: 7 },
  { key: "1m", label: "1m", days: 30 },
  { key: "3m", label: "3m", days: 90 },
  { key: "1y", label: "1 an", days: 365 },
];

const DEFAULT_PERIOD_OPTION: PeriodOption = PERIOD_OPTIONS[1] ?? {
  key: "1m",
  label: "1m",
  days: 30,
};

const MAX_SERIES_LOOKBACK_DAYS = 365 + SWC_BASELINE_DAYS + 7;

const PRIMARY_SERIES: PrimarySeriesConfig[] = [
  {
    key: "ln_rmssd_7d_avg",
    label: "LnRMSSD 7j",
    axis: "ln",
    color: "#2563eb",
    unit: "",
    accessor: (point) => point.ln_rmssd_7d_avg,
  },
  {
    key: "ln_rmssd",
    label: "LnRMSSD",
    axis: "ln",
    color: "#f97316",
    unit: "",
    accessor: (point) => point.ln_rmssd,
  },
  {
    key: "rmssd",
    label: "rMSSD",
    axis: "rmssd",
    color: "#0f766e",
    unit: "ms",
    accessor: (point) => point.rmssd,
  },
  {
    key: "resting_hr",
    label: "FC repos",
    axis: "hr",
    color: "#dc2626",
    unit: "bpm",
    accessor: (point) => point.resting_hr,
  },
  {
    key: "resting_hr_30d_avg",
    label: "FC repos 30j",
    axis: "hr",
    color: "#fb7185",
    unit: "bpm",
    dashed: true,
    accessor: (point) => point.resting_hr_30d_avg,
  },
];

const SCORE_SERIES: ScoreSeriesConfig[] = [
  {
    key: "sleep_quality",
    label: "Sleep Quality",
    color: "#16a34a",
    accessor: (point) => point.sleep_quality,
  },
  {
    key: "mental_energy",
    label: "Mental Energy",
    color: "#0891b2",
    accessor: (point) => point.mental_energy,
  },
  {
    key: "fatigue",
    label: "Fatigue",
    color: "#ea580c",
    accessor: (point) => point.fatigue,
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    color: "#4f46e5",
    accessor: (point) => point.lifestyle,
  },
  {
    key: "muscle_soreness",
    label: "Muscle Soreness",
    color: "#be123c",
    accessor: (point) => point.muscle_soreness,
  },
  {
    key: "physical_condition",
    label: "Physical Condition",
    color: "#0284c7",
    accessor: (point) => point.physical_condition,
  },
  {
    key: "training_performance",
    label: "Training Performance",
    color: "#059669",
    accessor: (point) => point.training_performance,
  },
  {
    key: "training_rpe",
    label: "Training RPE",
    color: "#d97706",
    accessor: (point) => point.training_rpe,
  },
  {
    key: "recovery_points",
    label: "Recovery Points",
    color: "#7c3aed",
    accessor: (point) => point.recovery_points,
  },
];

const DEFAULT_PRIMARY_SERIES = new Set<PrimarySeriesKey>([
  "ln_rmssd_7d_avg",
  "swc_band",
]);

const DEFAULT_SCORE_SERIES = new Set<ScoreSeriesKey>(["sleep_quality"]);

function formatDateLabel(iso: string, withYear = false): string {
  return format(parseISO(iso), withYear ? "d MMM yyyy" : "d MMM", { locale: fr });
}

function formatFullDate(iso: string): string {
  return format(parseISO(iso), "EEEE d MMM yyyy", { locale: fr });
}

function formatMetric(value: number | null, digits = 1): string {
  return value !== null ? value.toFixed(digits) : "—";
}

function formatTooltipMetric(value: number | null, unit: string, digits = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function computeDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    return [min - padding, max + padding];
  }

  const padding = Math.max((max - min) * 0.12, 0.5);
  return [min - padding, max + padding];
}

function getSwcBadge(
  status: DerivedHrvPoint["swc_status"] | null
): { label: string; variant: "emerald" | "amber" | "red" | "slate" } {
  switch (status) {
    case "within_swc":
      return { label: "Dans la SWC", variant: "emerald" };
    case "above_swc":
      return { label: "Au-dessus SWC", variant: "amber" };
    case "below_swc":
      return { label: "En-dessous SWC", variant: "red" };
    default:
      return { label: "Données insuffisantes", variant: "slate" };
  }
}

function getPeriodStart(anchorDate: string, period: TrendsPeriod): Date {
  const anchor = parseISO(anchorDate);
  const option =
    PERIOD_OPTIONS.find((item) => item.key === period) ??
    PERIOD_OPTIONS.find((item) => item.key === "1m") ??
    DEFAULT_PERIOD_OPTION;
  return subDays(anchor, option.days - 1);
}

function buildPrimaryChartRow(point: DerivedHrvPoint): PrimaryChartRow {
  return {
    timestamp: parseISO(point.date).getTime(),
    ln_rmssd_7d_avg: point.ln_rmssd_7d_avg,
    ln_rmssd: point.ln_rmssd,
    swc_low_28d: point.swc_low_28d,
    swc_high_28d: point.swc_high_28d,
    rmssd: point.rmssd,
    resting_hr: point.resting_hr,
    resting_hr_30d_avg: point.resting_hr_30d_avg,
  };
}

function buildScoreChartRow(point: DerivedHrvPoint): ScoreChartRow {
  return {
    timestamp: parseISO(point.date).getTime(),
    sleep_quality: point.sleep_quality,
    mental_energy: point.mental_energy,
    fatigue: point.fatigue,
    lifestyle: point.lifestyle,
    muscle_soreness: point.muscle_soreness,
    physical_condition: point.physical_condition,
    training_performance: point.training_performance,
    training_rpe: point.training_rpe,
    recovery_points: point.recovery_points,
  };
}

interface AthleteTrendsPageProps {
  athleteId?: string;
}

export function AthleteTrendsPage({ athleteId: propId }: AthleteTrendsPageProps = {}) {
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const isAthleteMode = !!propId;
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [period, setPeriod] = useState<TrendsPeriod>("1m");
  const [journalSortBy, setJournalSortBy] = useState<JournalSortBy>("date");
  const [journalSortDir, setJournalSortDir] = useState<SortDirection>("desc");
  const [visiblePrimary, setVisiblePrimary] =
    useState<Set<PrimarySeriesKey>>(new Set(DEFAULT_PRIMARY_SERIES));
  const [visibleScores, setVisibleScores] =
    useState<Set<ScoreSeriesKey>>(new Set(DEFAULT_SCORE_SERIES));
  const { readinessSeries, healthData, isLoading } = useReadiness(
    id,
    MAX_SERIES_LOOKBACK_DAYS
  );
  useEffect(() => {
    if (!id) return;
    getAthleteById(id).then(setAthlete).catch(console.error);
  }, [id]);

  const timeline = useMemo(() => buildHrvTimeline(readinessSeries), [readinessSeries]);
  const latestSignalPoint = useMemo(() => getLatestSignalPoint(timeline), [timeline]);
  const latestContextPoint = useMemo(() => getLatestContextPoint(timeline), [timeline]);
  const anchorDate = latestSignalPoint?.date ?? null;
  const lastTimelineDate = timeline.length > 0 ? timeline[timeline.length - 1]!.date : null;
  const displayEndDate = lastTimelineDate && anchorDate
    ? (lastTimelineDate > anchorDate ? lastTimelineDate : anchorDate)
    : anchorDate;

  const displayTimeline = useMemo(() => {
    if (!anchorDate || !displayEndDate) return [];
    const start = getPeriodStart(anchorDate, period).getTime();
    const end = parseISO(displayEndDate).getTime();
    return timeline.filter((point) => {
      const timestamp = parseISO(point.date).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }, [anchorDate, displayEndDate, period, timeline]);

  const primaryChartData = useMemo(
    () => displayTimeline.map(buildPrimaryChartRow),
    [displayTimeline]
  );

  const scoreChartData = useMemo(
    () => displayTimeline.map(buildScoreChartRow),
    [displayTimeline]
  );

  const dateRange = useMemo(() => {
    if (displayTimeline.length === 0) return "Aucune donnée sur la période";
    const first = displayTimeline[0]?.date;
    const last = displayTimeline[displayTimeline.length - 1]?.date;
    if (!first || !last) return "Aucune donnée sur la période";
    return `${formatDateLabel(first)} — ${formatDateLabel(last, true)}`;
  }, [displayTimeline]);

  const latestLnRmssd7d = latestSignalPoint?.ln_rmssd_7d_avg ?? null;
  const latestHr = latestSignalPoint?.resting_hr ?? null;
  const avg30dHr = latestSignalPoint?.resting_hr_30d_avg ?? null;
  const hrDiff =
    latestHr !== null && avg30dHr !== null ? latestHr - avg30dHr : null;
  const last7 = timeline.slice(-7);
  const maxLnRmssd = Math.max(
    ...last7.map((point) => point.ln_rmssd_7d_avg ?? point.ln_rmssd ?? 0),
    1
  );
  const maxHr = Math.max(...last7.map((point) => point.resting_hr ?? 0), 1);

  const athleteHealth = healthData.find((health) => health.athlete_id === id);
  const poids = athleteHealth?.poids ?? null;

  const primaryDomains = useMemo(() => {
    const lnValues: number[] = [];
    const rmssdValues: number[] = [];
    const hrValues: number[] = [];

    for (const point of displayTimeline) {
      if (point.ln_rmssd_7d_avg !== null) {
        lnValues.push(point.ln_rmssd_7d_avg);
      }
      if (point.ln_rmssd !== null) {
        lnValues.push(point.ln_rmssd);
      }
      if (point.swc_low_28d !== null) lnValues.push(point.swc_low_28d);
      if (point.swc_high_28d !== null) lnValues.push(point.swc_high_28d);
      if (visiblePrimary.has("rmssd") && point.rmssd !== null) {
        rmssdValues.push(point.rmssd);
      }
      if (visiblePrimary.has("resting_hr") && point.resting_hr !== null) {
        hrValues.push(point.resting_hr);
      }
      if (
        visiblePrimary.has("resting_hr_30d_avg") &&
        point.resting_hr_30d_avg !== null
      ) {
        hrValues.push(point.resting_hr_30d_avg);
      }
    }

    return {
      ln: computeDomain(lnValues),
      rmssd: computeDomain(rmssdValues),
      hr: computeDomain(hrValues),
    };
  }, [displayTimeline, visiblePrimary]);

  const swcAreas = useMemo(() => {
    const areas: Array<{
      x1: number;
      x2: number;
      y1: number;
      y2: number;
    }> = [];

    if (!visiblePrimary.has("swc_band")) return areas;

    for (let index = 0; index < primaryChartData.length - 1; index += 1) {
      const current = primaryChartData[index];
      const next = primaryChartData[index + 1];
      if (
        !current ||
        !next ||
        current.swc_low_28d === null ||
        current.swc_high_28d === null
      ) {
        continue;
      }

      areas.push({
        x1: current.timestamp,
        x2: next.timestamp,
        y1: current.swc_low_28d,
        y2: current.swc_high_28d,
      });
    }

    return areas;
  }, [primaryChartData, visiblePrimary]);

  const latestSubjectiveRows = useMemo(
    () =>
      [...timeline]
        .reverse()
        .filter(
          (point) =>
            point.sickness !== null ||
            point.alcohol !== null ||
            point.sleep_quality !== null ||
            point.mental_energy !== null ||
            point.fatigue !== null ||
            point.lifestyle !== null
        )
        .slice(0, 50),
    [timeline]
  );

  const sortedSubjectiveRows = useMemo(
    () =>
      sortRows(
        latestSubjectiveRows,
        (row) => {
          switch (journalSortBy) {
            case "sleep": return row.sleep_quality;
            case "energy": return row.mental_energy;
            case "fatigue": return row.fatigue;
            case "lifestyle": return row.lifestyle;
            case "sickness": return row.sickness;
            case "alcohol": return row.alcohol;
            case "date":
            default: return new Date(row.date);
          }
        },
        journalSortDir
      ),
    [latestSubjectiveRows, journalSortBy, journalSortDir]
  );

  const handleJournalSort = (column: JournalSortBy) => {
    if (journalSortBy !== column) {
      setJournalSortBy(column);
      setJournalSortDir(column === "date" ? "desc" : "desc");
      return;
    }
    if (journalSortDir === "desc") {
      setJournalSortDir("asc");
      return;
    }
    setJournalSortBy("date");
    setJournalSortDir("desc");
  };

  const alertes = useMemo(() => {
    if (!latestSignalPoint) return [];

    const items: {
      type: "green" | "orange" | "neutral";
      title: string;
      text: string;
      icon: string;
      date: string;
    }[] = [];

    if (latestSignalPoint.swc_status === "within_swc") {
      items.push({
        type: "green",
        title: "Signal SWC stable",
        text: "La moyenne glissante 7 jours de LnRMSSD reste dans la SWC dynamique calculée sur les 28 jours précédents.",
        icon: "check_circle",
        date: formatFullDate(latestSignalPoint.date),
      });
    } else if (
      latestSignalPoint.swc_status === "above_swc" ||
      latestSignalPoint.swc_status === "below_swc"
    ) {
      items.push({
        type: "orange",
        title: "Low/Rest recommandé",
        text: "La moyenne glissante 7 jours de LnRMSSD sort de la SWC dynamique. Alléger la charge et privilégier low/rest.",
        icon: "warning_amber",
        date: formatFullDate(latestSignalPoint.date),
      });
    } else {
      items.push({
        type: "neutral",
        title: "Historique insuffisant",
        text: "Autour de la dernière mesure valide, il manque encore assez de données pour établir un signal SWC fiable.",
        icon: "info",
        date: formatFullDate(latestSignalPoint.date),
      });
    }

    const last14 = timeline.slice(-14);
    const swcOutCount = last14.filter(
      (point) => point.swc_status === "above_swc" || point.swc_status === "below_swc"
    ).length;
    if (swcOutCount > 0) {
      items.push({
        type: swcOutCount >= 3 ? "orange" : "neutral",
        title: `${swcOutCount} sortie${swcOutCount > 1 ? "s" : ""} SWC sur 14j`,
        text: `L'athlète est sorti${swcOutCount > 1 ? "e" : ""} de la bande SWC ${swcOutCount} fois sur les 14 derniers jours.`,
        icon: swcOutCount >= 3 ? "warning_amber" : "info",
        date: formatFullDate(latestSignalPoint.date),
      });
    }

    if (latestHr !== null && avg30dHr !== null && latestHr - avg30dHr > 3) {
      items.push({
        type: "orange",
        title: "FC repos élevée",
        text: `La FC au repos (${latestHr.toFixed(1)} bpm) dépasse la moyenne 30j (${avg30dHr.toFixed(1)} bpm) de +${(latestHr - avg30dHr).toFixed(1)} bpm.`,
        icon: "monitor_heart",
        date: formatFullDate(latestSignalPoint.date),
      });
    }

    return items;
  }, [latestSignalPoint, timeline, latestHr, avg30dHr]);

  const togglePrimary = (key: PrimarySeriesKey) => {
    setVisiblePrimary((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleScore = (key: ScoreSeriesKey) => {
    setVisibleScores((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  if (timeline.length === 0 || !anchorDate || !latestSignalPoint) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {!isAthleteMode && athlete && (
              <AthleteSubNav athlete={athlete} active="trends" />
            )}
            {isAthleteMode ? (
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
                Mes tendances
              </h2>
            ) : (
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mt-4">
                Rapport de Santé Détaillé
              </h2>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Icon name="monitoring" className="text-4xl text-slate-400" />
          <p className="text-sm text-slate-500">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="athlete-trends-page">
      <div>
        {!isAthleteMode && athlete && (
          <AthleteSubNav athlete={athlete} active="trends" />
        )}
        {isAthleteMode ? (
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-1">
            Mes tendances
          </h2>
        ) : (
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mt-4">
            Rapport de Santé Détaillé
          </h2>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vue ancrée sur la dernière mesure valide du {formatDateLabel(anchorDate, true)} • {dateRange}
        </p>
      </div>

      <FeatureNotice
        title="Vue tendances SWC"
        description="Le signal readiness est ancré sur la dernière mesure valide disponible, pas sur la date du jour."
        status="partial"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" data-testid="trends-swc-summary">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  LnRMSSD 7j
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-semibold text-slate-900 dark:text-white font-mono">
                    {latestLnRmssd7d !== null ? latestLnRmssd7d.toFixed(3) : "—"}
                  </h3>
                </div>
              </div>
              <div className="flex items-end gap-1 h-20">
                {last7.map((point, index) => (
                  <div
                    key={index}
                    className="w-3 bg-primary rounded-none"
                    style={{
                      height: `${(((point.ln_rmssd_7d_avg ?? point.ln_rmssd ?? 0) / maxLnRmssd) * 100).toFixed(0)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3 min-h-[28px]">
              <Badge variant={getSwcBadge(latestSignalPoint.swc_status).variant}>
                {getSwcBadge(latestSignalPoint.swc_status).label}
              </Badge>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatDateLabel(anchorDate, true)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium min-h-[32px]">
              {latestSignalPoint.swc_status === "within_swc"
                ? "La moyenne 7j reste dans la bande SWC."
                : latestSignalPoint.swc_status === "above_swc" || latestSignalPoint.swc_status === "below_swc"
                  ? "La moyenne 7j sort de la bande SWC."
                  : "Le signal SWC est encore en construction sur la dernière mesure disponible."}
            </p>
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SWC Low</p>
                <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {latestSignalPoint.swc_low_28d?.toFixed(3) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SWC High</p>
                <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {latestSignalPoint.swc_high_28d?.toFixed(3) ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  FC au repos
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-semibold text-slate-900 dark:text-white font-mono">
                    {latestHr !== null ? latestHr.toFixed(1) : "—"}
                  </h3>
                  {hrDiff !== null && (
                    <span
                      className={`text-sm font-medium ${
                        hrDiff <= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      {hrDiff > 0 ? "+" : ""}
                      {hrDiff.toFixed(1)} bpm
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-1 h-20">
                {last7.map((point, index) => (
                  <div
                    key={index}
                    className="w-3 bg-red-500 rounded-none"
                    style={{
                      height: `${(((point.resting_hr ?? 0) / maxHr) * 100).toFixed(0)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3 min-h-[28px]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatDateLabel(anchorDate, true)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium min-h-[32px]">
              Comparaison à la moyenne 30 jours, à la date de la dernière mesure valide.
            </p>
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Moy 30j</p>
                <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {latestSignalPoint.resting_hr_30d_avg?.toFixed(1) ?? "—"} <span className="text-xs font-normal text-slate-400">bpm</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dernier contexte
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={latestContextPoint ? "primary" : "slate"}>
                  {latestContextPoint ? "Importé" : "Aucun"}
                </Badge>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {latestContextPoint ? formatDateLabel(latestContextPoint.date, true) : "—"}
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {([
                { label: "Sleep", value: latestContextPoint?.sleep_quality ?? null, color: "#16a34a" },
                { label: "Energy", value: latestContextPoint?.mental_energy ?? null, color: "#0891b2" },
                { label: "Fatigue", value: latestContextPoint?.fatigue ?? null, color: "#ea580c" },
                { label: "Lifestyle", value: latestContextPoint?.lifestyle ?? null, color: "#4f46e5" },
                { label: "Physical", value: latestContextPoint?.physical_condition ?? null, color: "#0284c7" },
                { label: "Recovery", value: latestContextPoint?.recovery_points ?? null, color: "#7c3aed" },
              ] as const).map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0 text-right">
                    {item.label}
                  </span>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: item.value !== null ? `${(item.value / 10) * 100}%` : "0%",
                        backgroundColor: item.color,
                        opacity: item.value !== null ? 1 : 0.3,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white w-8 text-right">
                    {formatMetric(item.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={latestContextPoint?.sickness && latestContextPoint.sickness !== "not sick" ? "amber" : "slate"}>
                {latestContextPoint?.sickness ?? "sickness —"}
              </Badge>
              <Badge variant={latestContextPoint?.alcohol && latestContextPoint.alcohol !== "nothing" ? "amber" : "slate"}>
                {latestContextPoint?.alcohol ?? "alcohol —"}
              </Badge>
              {poids !== null && (
                <Badge variant="slate">{poids.toFixed(1)} kg</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Icon name="show_chart" className="text-slate-500 dark:text-slate-400" />
                  Tendances HRV & SWC
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Vue par défaut: LnRMSSD 7j et SWC.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={`primary-${option.key}`}
                    type="button"
                    size="sm"
                    variant={period === option.key ? "primary" : "secondary"}
                    onClick={() => setPeriod(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => togglePrimary("ln_rmssd_7d_avg")}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                style={
                  visiblePrimary.has("ln_rmssd_7d_avg")
                    ? { backgroundColor: "#2563eb", color: "#fff" }
                    : { border: "1.5px solid #2563eb", color: "#2563eb", background: "transparent" }
                }
              >
                LnRMSSD 7j
              </button>
              <button
                type="button"
                onClick={() => togglePrimary("swc_band")}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                style={
                  visiblePrimary.has("swc_band")
                    ? { background: "linear-gradient(90deg, #059669 0%, #d97706 100%)", color: "#fff" }
                    : { border: "1.5px solid #475569", color: "#475569", background: "transparent" }
                }
              >
                SWC
              </button>
              {PRIMARY_SERIES.filter((series) => series.key !== "ln_rmssd_7d_avg").map((series) => {
                const active = visiblePrimary.has(series.key);
                return (
                  <button
                    key={series.key}
                    type="button"
                    onClick={() => togglePrimary(series.key)}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                    style={
                      active
                        ? { backgroundColor: series.color, color: "#fff" }
                        : { border: `1.5px solid ${series.color}`, color: series.color, background: "transparent" }
                    }
                  >
                    {series.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={primaryChartData}
                margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.22}
                />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={[
                    displayTimeline.length > 0
                      ? parseISO(displayTimeline[0]?.date ?? anchorDate).getTime()
                      : parseISO(anchorDate).getTime(),
                    parseISO(displayEndDate!).getTime(),
                  ]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: fr })}
                  minTickGap={28}
                />
                <YAxis yAxisId="ln" hide domain={primaryDomains.ln} />
                <YAxis yAxisId="rmssd" hide domain={primaryDomains.rmssd} />
                <YAxis yAxisId="hr" hide domain={primaryDomains.hr} />
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(Number(value)), "EEEE d MMM yyyy", { locale: fr })
                  }
                  formatter={(value, _name, item) => {
                    const dataKey = item.dataKey as keyof PrimaryChartRow;
                    const numericValue =
                      typeof value === "number" ? value : Number(value);
                    if (dataKey === "swc_low_28d" || dataKey === "swc_high_28d") {
                      return [
                        formatTooltipMetric(
                          Number.isFinite(numericValue) ? numericValue : null,
                          "",
                          3
                        ),
                        dataKey === "swc_low_28d" ? "SWC bas" : "SWC haut",
                      ];
                    }

                    const config = PRIMARY_SERIES.find((series) => series.key === dataKey);
                    return [
                      formatTooltipMetric(
                        Number.isFinite(numericValue) ? numericValue : null,
                        config?.unit ?? "",
                        config?.axis === "ln" ? 3 : 1
                      ),
                      config?.label ?? dataKey,
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "var(--tw-colors-slate-800)",
                    borderRadius: "8px",
                    border: "1px solid var(--tw-colors-slate-700)",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "#f8fafc" }}
                />
                {swcAreas.map((area, index) => (
                  <ReferenceArea
                    key={`swc-area-${index}`}
                    yAxisId="ln"
                    x1={area.x1}
                    x2={area.x2}
                    y1={area.y1}
                    y2={area.y2}
                    fill="#22c55e"
                    fillOpacity={0.18}
                    ifOverflow="extendDomain"
                    isFront={false}
                  />
                ))}
                {PRIMARY_SERIES.filter((series) => visiblePrimary.has(series.key)).map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    yAxisId={series.axis}
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={series.key === "ln_rmssd_7d_avg" ? 3 : 2}
                    strokeDasharray={series.dashed ? "5 4" : undefined}
                    dot={series.key === "ln_rmssd_7d_avg" ? { r: 3, fill: series.color, strokeWidth: 0 } : false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
                {visiblePrimary.has("swc_band") && (
                  <>
                    <Line
                      type="monotone"
                      yAxisId="ln"
                      dataKey="swc_low_28d"
                      name="SWC bas"
                      stroke="#059669"
                      strokeWidth={3.5}
                      strokeDasharray="10 6"
                      dot={{ r: 3, fill: "#059669", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#059669", strokeWidth: 0 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      yAxisId="ln"
                      dataKey="swc_high_28d"
                      name="SWC haut"
                      stroke="#d97706"
                      strokeWidth={3.5}
                      strokeDasharray="10 6"
                      dot={{ r: 3, fill: "#d97706", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#d97706", strokeWidth: 0 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Icon name="psychology" className="text-slate-500 dark:text-slate-400" />
                  Scores /10
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Toutes les métriques du CSV notées sur 10, sur une échelle commune.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={`score-${option.key}`}
                    type="button"
                    size="sm"
                    variant={period === option.key ? "primary" : "secondary"}
                    onClick={() => setPeriod(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SCORE_SERIES.map((series) => {
                const active = visibleScores.has(series.key);
                return (
                  <button
                    key={series.key}
                    type="button"
                    onClick={() => toggleScore(series.key)}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                    style={
                      active
                        ? { backgroundColor: series.color, color: "#fff" }
                        : { border: `1.5px solid ${series.color}`, color: series.color, background: "transparent" }
                    }
                  >
                    {series.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scoreChartData}
                margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.18}
                />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={[
                    displayTimeline.length > 0
                      ? parseISO(displayTimeline[0]?.date ?? anchorDate).getTime()
                      : parseISO(anchorDate).getTime(),
                    parseISO(displayEndDate!).getTime(),
                  ]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: fr })}
                  minTickGap={28}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 2, 4, 6, 8, 10]}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(Number(value)), "EEEE d MMM yyyy", { locale: fr })
                  }
                  formatter={(value, _name, item) => {
                    const series = SCORE_SERIES.find((entry) => entry.key === item.dataKey);
                    const numericValue =
                      typeof value === "number" ? value : Number(value);
                    return [
                      formatTooltipMetric(
                        Number.isFinite(numericValue) ? numericValue : null,
                        "/10",
                        1
                      ),
                      series?.label ?? String(item.dataKey),
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "var(--tw-colors-slate-800)",
                    borderRadius: "8px",
                    border: "1px solid var(--tw-colors-slate-700)",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "#f8fafc" }}
                />
                {SCORE_SERIES.filter((series) => visibleScores.has(series.key)).map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="warning" className="text-slate-500 dark:text-slate-400" />
            Alertes récentes
          </h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {alertes.map((alerte, index) => (
              <div
                key={index}
                className={`bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 border-l-4 rounded-md p-4 flex items-start gap-3 ${
                  alerte.type === "green"
                    ? "border-l-emerald-500"
                    : alerte.type === "orange"
                      ? "border-l-accent-orange"
                      : "border-l-slate-400"
                }`}
              >
                <Icon
                  name={alerte.icon}
                  className={`mt-0.5 ${
                    alerte.type === "green"
                      ? "text-emerald-500"
                      : alerte.type === "orange"
                        ? "text-accent-orange"
                        : "text-slate-400"
                  }`}
                />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {alerte.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {alerte.text}
                  </p>
                  <span className="text-[10px] font-semibold text-slate-500 mt-2 block uppercase tracking-wider">
                    {alerte.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="calendar_today" className="text-slate-500 dark:text-slate-400" />
            Journal quotidien
          </h3>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <SortableHeader label="Date" active={journalSortBy === "date"} direction={journalSortDir} onToggle={() => handleJournalSort("date")} className="px-4 py-3" />
                    <SortableHeader label="Sleep" active={journalSortBy === "sleep"} direction={journalSortDir} onToggle={() => handleJournalSort("sleep")} className="px-4 py-3" />
                    <SortableHeader label="Energy" active={journalSortBy === "energy"} direction={journalSortDir} onToggle={() => handleJournalSort("energy")} className="px-4 py-3" />
                    <SortableHeader label="Fatigue" active={journalSortBy === "fatigue"} direction={journalSortDir} onToggle={() => handleJournalSort("fatigue")} className="px-4 py-3" />
                    <SortableHeader label="Lifestyle" active={journalSortBy === "lifestyle"} direction={journalSortDir} onToggle={() => handleJournalSort("lifestyle")} className="px-4 py-3" />
                    <SortableHeader label="Sickness" active={journalSortBy === "sickness"} direction={journalSortDir} onToggle={() => handleJournalSort("sickness")} className="px-4 py-3" />
                    <SortableHeader label="Alcohol" active={journalSortBy === "alcohol"} direction={journalSortDir} onToggle={() => handleJournalSort("alcohol")} className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedSubjectiveRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-sm text-center text-slate-500">
                        Aucune donnée subjective sur la période sélectionnée.
                      </td>
                    </tr>
                  ) : (
                    sortedSubjectiveRows.map((row) => (
                      <tr key={row.date}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {formatDateLabel(row.date, true)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatMetric(row.sleep_quality)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatMetric(row.mental_energy)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatMetric(row.fatigue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {formatMetric(row.lifestyle)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={row.sickness && row.sickness !== "not sick" ? "amber" : "slate"}>
                            {row.sickness ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={row.alcohol && row.alcohol !== "nothing" ? "amber" : "slate"}>
                            {row.alcohol ?? "—"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
