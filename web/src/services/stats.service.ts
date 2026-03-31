import {
  addMilliseconds,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { StatsActivityRow } from "@/repositories/stats.repository";
import { mapSportLabel, normalizeSportKey } from "@/services/activity.service";
import { generateInsights, type TextInsight, type FocusAlert } from "@/services/analysis.service";
import { HR_ZONE_COLORS } from "@/lib/constants";

export type KpiPeriod = "week" | "month";

export interface KpiCard {
  key: "distance" | "hours" | "sessions" | "rpe" | "decoupling";
  label: string;
  value: number | null;
  displayValue: string;
  deltaPct: number | null;
  deltaDisplay: string | null;
}

export interface SportDistributionItem {
  sportKey: string;
  label: string;
  durationSec: number;
  hours: number;
  percent: number;
  distanceKm: number;
  avgRpe: number | null;
  sessionCount: number;
}

export interface HrZonesAggregate {
  zones: Array<{ zone: string; seconds: number; percent: number; color: string }>;
  totalSec: number;
}

export interface WeeklyLoadPoint {
  weekStart: string;
  label: string;
  load: number;
}

export interface SportDecouplingItem {
  sportKey: string;
  label: string;
  sessionCount: number;
  avgDecoupling: number | null;
  displayValue: string;
}

export interface AthleteKpiReport {
  period: KpiPeriod;
  periodLabel: string;
  currentRangeLabel: string;
  comparisonRangeLabel: string;
  cards: KpiCard[];
  distribution: SportDistributionItem[];
  weeklyLoad: WeeklyLoadPoint[];
  sportDecoupling: SportDecouplingItem[];
  insights: TextInsight[];
  focusAlert: FocusAlert | null;
  hrZones: HrZonesAggregate | null;
  availableSports: string[];
}

interface PeriodWindow {
  start: Date;
  end: Date;
}

export interface NormalizedStatsActivity {
  activityId: string;
  sessionDate: Date;
  sportKey: string;
  sportLabel: string;
  distanceM: number;
  durationSec: number;
  loadIndex: number | null;
  rpe: number | null;
  decouplingIndex: number | null;
  durabilityIndex: number | null;
  avgHr: number | null;
  workType: string | null;
  activityName: string | null;
  segmentedMetrics: Record<string, unknown> | null;
  hrZonesSec?: Record<string, number> | null;
}

const ONE_DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const SIGNED_ONE_DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "always",
});
const WEEKLY_LOAD_POINT_COUNT = 8;
const MAX_DISTRIBUTION_SPORTS = 3;

function getCurrentPeriodWindow(period: KpiPeriod, now: Date): PeriodWindow {
  const start = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const today = new Date();
  const periodEnd = period === "week"
    ? endOfWeek(now, { weekStartsOn: 1 })
    : endOfMonth(now);
  // If `now` falls in the real current period, cap at today (partial).
  // Otherwise (historical), use the full period end.
  const isCurrentPeriod = today >= start && today <= periodEnd;
  return {
    start,
    end: isCurrentPeriod ? today : periodEnd,
  };
}

function getPreviousPeriodWindow(period: KpiPeriod, currentWindow: PeriodWindow): PeriodWindow {
  const previousStart =
    period === "week"
      ? subWeeks(currentWindow.start, 1)
      : startOfMonth(subMonths(currentWindow.start, 1));
  const elapsedMs = Math.max(currentWindow.end.getTime() - currentWindow.start.getTime(), 0);
  const rawEnd = addMilliseconds(previousStart, elapsedMs);

  return {
    start: previousStart,
    end: period === "month" && rawEnd > endOfMonth(previousStart) ? endOfMonth(previousStart) : rawEnd,
  };
}

function getOldestLoadWeekStart(now: Date): Date {
  return subWeeks(startOfWeek(now, { weekStartsOn: 1 }), WEEKLY_LOAD_POINT_COUNT - 1);
}

function isWithinWindow(date: Date, window: PeriodWindow): boolean {
  return date >= window.start && date <= window.end;
}

function toDurationSec(row: StatsActivityRow): number {
  return row.moving_time_sec ?? row.duration_sec ?? 0;
}

function normalizeActivity(row: StatsActivityRow): NormalizedStatsActivity {
  const rawSport = row.sport_type?.trim() || "Autre";
  return {
    activityId: row.id,
    sessionDate: parseISO(row.session_date),
    sportKey: normalizeSportKey(rawSport),
    sportLabel: mapSportLabel(rawSport),
    distanceM: row.distance_m ?? 0,
    durationSec: toDurationSec(row),
    loadIndex: row.load_index,
    rpe: row.rpe,
    decouplingIndex: row.decoupling_index,
    durabilityIndex: row.durability_index ?? null,
    avgHr: row.avg_hr ?? null,
    workType: row.work_type ?? null,
    activityName: row.activity_name ?? null,
    segmentedMetrics: row.segmented_metrics ?? null,
    hrZonesSec: row.hr_zones_sec ?? null,
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatRangeLabel(window: PeriodWindow): string {
  return `${format(window.start, "d MMM", { locale: fr })} — ${format(window.end, "d MMM", { locale: fr })}`;
}

function buildDeltaDisplay(current: number | null, previous: number | null): {
  deltaPct: number | null;
  deltaDisplay: string | null;
} {
  if (current == null || previous == null || previous === 0) {
    return { deltaPct: null, deltaDisplay: null };
  }

  const deltaPct = ((current - previous) / previous) * 100;
  return {
    deltaPct,
    deltaDisplay: `${SIGNED_ONE_DECIMAL.format(deltaPct)} %`,
  };
}

function buildKpiCards(currentRows: NormalizedStatsActivity[], previousRows: NormalizedStatsActivity[]): KpiCard[] {
  const currentDistanceKm = currentRows.reduce((sum, row) => sum + row.distanceM, 0) / 1000;
  const previousDistanceKm = previousRows.reduce((sum, row) => sum + row.distanceM, 0) / 1000;
  const currentHours = currentRows.reduce((sum, row) => sum + row.durationSec, 0) / 3600;
  const previousHours = previousRows.reduce((sum, row) => sum + row.durationSec, 0) / 3600;
  const currentSessions = currentRows.length;
  const previousSessions = previousRows.length;
  const currentRpe = mean(
    currentRows
      .map((row) => row.rpe)
      .filter((value): value is number => value != null)
  );
  const previousRpe = mean(
    previousRows
      .map((row) => row.rpe)
      .filter((value): value is number => value != null)
  );
  const currentDecoupling = mean(
    currentRows
      .map((row) => row.decouplingIndex)
      .filter((value): value is number => value != null)
  );
  const previousDecoupling = mean(
    previousRows
      .map((row) => row.decouplingIndex)
      .filter((value): value is number => value != null)
  );

  return [
    {
      key: "distance",
      label: "Distance",
      value: round1(currentDistanceKm),
      displayValue: `${ONE_DECIMAL.format(currentDistanceKm)} km`,
      ...buildDeltaDisplay(currentDistanceKm, previousDistanceKm),
    },
    {
      key: "hours",
      label: "Heures",
      value: round1(currentHours),
      displayValue: `${ONE_DECIMAL.format(currentHours)} h`,
      ...buildDeltaDisplay(currentHours, previousHours),
    },
    {
      key: "sessions",
      label: "Séances",
      value: currentSessions,
      displayValue: String(currentSessions),
      ...buildDeltaDisplay(currentSessions, previousSessions),
    },
    {
      key: "rpe",
      label: "RPE moyen",
      value: currentRpe != null ? round1(currentRpe) : null,
      displayValue: currentRpe != null ? ONE_DECIMAL.format(currentRpe) : "--",
      ...buildDeltaDisplay(currentRpe, previousRpe),
    },
    {
      key: "decoupling",
      label: "Découplage moyen",
      value: currentDecoupling != null ? round1(currentDecoupling) : null,
      displayValue: currentDecoupling != null ? `${ONE_DECIMAL.format(currentDecoupling)} %` : "--",
      ...buildDeltaDisplay(currentDecoupling, previousDecoupling),
    },
  ];
}

function buildDistribution(rows: NormalizedStatsActivity[]): SportDistributionItem[] {
  const totals = new Map<string, {
    label: string;
    durationSec: number;
    distanceM: number;
    rpeValues: number[];
    count: number;
  }>();

  for (const row of rows) {
    const existing = totals.get(row.sportKey);
    if (existing) {
      existing.durationSec += row.durationSec;
      existing.distanceM += row.distanceM;
      existing.count += 1;
      if (row.rpe != null) existing.rpeValues.push(row.rpe);
    } else {
      totals.set(row.sportKey, {
        label: row.sportLabel,
        durationSec: row.durationSec,
        distanceM: row.distanceM,
        rpeValues: row.rpe != null ? [row.rpe] : [],
        count: 1,
      });
    }
  }

  const totalDuration = [...totals.values()].reduce((sum, row) => sum + row.durationSec, 0);
  const sorted = [...totals.entries()]
    .map(([sportKey, value]) => ({
      sportKey,
      label: value.label,
      durationSec: value.durationSec,
      hours: value.durationSec / 3600,
      percent: totalDuration > 0 ? (value.durationSec / totalDuration) * 100 : 0,
      distanceKm: value.distanceM / 1000,
      avgRpe: mean(value.rpeValues),
      sessionCount: value.count,
    }))
    .sort((left, right) => right.durationSec - left.durationSec);

  if (sorted.length <= MAX_DISTRIBUTION_SPORTS + 1) {
    return sorted.map((item) => ({
      ...item,
      hours: round1(item.hours),
      percent: round1(item.percent),
      distanceKm: round1(item.distanceKm),
      avgRpe: item.avgRpe != null ? round1(item.avgRpe) : null,
    }));
  }

  const head = sorted.slice(0, MAX_DISTRIBUTION_SPORTS);
  const tail = sorted.slice(MAX_DISTRIBUTION_SPORTS);
  const otherDuration = tail.reduce((sum, item) => sum + item.durationSec, 0);
  const otherDistance = tail.reduce((sum, item) => sum + item.distanceKm * 1000, 0);
  const otherRpeValues = tail.flatMap((item) =>
    item.avgRpe != null ? [item.avgRpe] : []
  );
  const otherSessionCount = tail.reduce((sum, item) => sum + item.sessionCount, 0);

  return [
    ...head,
    {
      sportKey: "AUTRES",
      label: "Autres",
      durationSec: otherDuration,
      hours: otherDuration / 3600,
      percent: totalDuration > 0 ? (otherDuration / totalDuration) * 100 : 0,
      distanceKm: otherDistance / 1000,
      avgRpe: mean(otherRpeValues),
      sessionCount: otherSessionCount,
    },
  ].map((item) => ({
    ...item,
    hours: round1(item.hours),
    percent: round1(item.percent),
    distanceKm: round1(item.distanceKm),
    avgRpe: item.avgRpe != null ? round1(item.avgRpe) : null,
  }));
}

const HR_ZONE_KEYS = ["Z1i", "Z1ii", "Z2i", "Z2ii", "Z3i", "Z3ii"] as const;

function aggregateHrZones(rows: NormalizedStatsActivity[]): HrZonesAggregate | null {
  const totals: Record<string, number> = {};
  let hasData = false;

  for (const row of rows) {
    if (row.hrZonesSec != null) {
      hasData = true;
      for (const zone of HR_ZONE_KEYS) {
        totals[zone] = (totals[zone] ?? 0) + (row.hrZonesSec[zone] ?? 0);
      }
    }
  }

  if (!hasData) return null;

  const totalSec = HR_ZONE_KEYS.reduce((sum, z) => sum + (totals[z] ?? 0), 0);
  if (totalSec === 0) return null;

  return {
    zones: HR_ZONE_KEYS.map((zone) => ({
      zone,
      seconds: totals[zone] ?? 0,
      percent: ((totals[zone] ?? 0) / totalSec) * 100,
      color: HR_ZONE_COLORS[zone],
    })),
    totalSec,
  };
}

function buildWeeklyLoad(rows: NormalizedStatsActivity[], now: Date): WeeklyLoadPoint[] {
  const firstWeekStart = getOldestLoadWeekStart(now);
  const weeklyLoadMap = new Map<string, number>();

  for (const row of rows) {
    const weekStart = startOfWeek(row.sessionDate, { weekStartsOn: 1 });
    const key = weekStart.toISOString();
    weeklyLoadMap.set(key, (weeklyLoadMap.get(key) ?? 0) + (row.loadIndex ?? 0));
  }

  return Array.from({ length: WEEKLY_LOAD_POINT_COUNT }, (_, index) => {
    const weekStart = addWeeks(firstWeekStart, index);
    const key = weekStart.toISOString();
    return {
      weekStart: weekStart.toISOString(),
      label: format(weekStart, "d MMM", { locale: fr }),
      load: round1(weeklyLoadMap.get(key) ?? 0),
    };
  });
}

function buildSportDecoupling(rows: NormalizedStatsActivity[]): SportDecouplingItem[] {
  const grouped = new Map<string, { label: string; sessionCount: number; decouplingValues: number[] }>();

  for (const row of rows) {
    const existing = grouped.get(row.sportKey);
    if (existing) {
      existing.sessionCount += 1;
      if (row.decouplingIndex != null) existing.decouplingValues.push(row.decouplingIndex);
    } else {
      grouped.set(row.sportKey, {
        label: row.sportLabel,
        sessionCount: 1,
        decouplingValues: row.decouplingIndex != null ? [row.decouplingIndex] : [],
      });
    }
  }

  return [...grouped.entries()]
    .map(([sportKey, value]) => {
      const avgDecoupling = mean(value.decouplingValues);
      return {
        sportKey,
        label: value.label,
        sessionCount: value.sessionCount,
        avgDecoupling: avgDecoupling != null ? round1(avgDecoupling) : null,
        displayValue: avgDecoupling != null ? `${ONE_DECIMAL.format(avgDecoupling)} %` : "--",
      };
    })
    .sort((left, right) => right.sessionCount - left.sessionCount || left.label.localeCompare(right.label, "fr"));
}

export function getAthleteKpiFetchRange(period: KpiPeriod, now = new Date()): PeriodWindow {
  const currentWindow = getCurrentPeriodWindow(period, now);
  const previousWindow = getPreviousPeriodWindow(period, currentWindow);
  const weeklyStart = getOldestLoadWeekStart(now);
  const start = previousWindow.start < weeklyStart ? previousWindow.start : weeklyStart;

  return {
    start,
    end: currentWindow.end,
  };
}

export function buildPeriodLabel(period: KpiPeriod, now: Date): string {
  const today = new Date();
  const start = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const currentStart = period === "week" ? startOfWeek(today, { weekStartsOn: 1 }) : startOfMonth(today);
  if (isSameDay(start, currentStart)) {
    return period === "week" ? "Cette semaine" : "Ce mois-ci";
  }
  if (period === "week") {
    return format(start, "'Semaine du' d MMMM yyyy", { locale: fr });
  }
  return format(start, "MMMM yyyy", { locale: fr });
}

export function isCurrentPeriod(period: KpiPeriod, anchorDate: Date): boolean {
  const today = new Date();
  const start = period === "week" ? startOfWeek(anchorDate, { weekStartsOn: 1 }) : startOfMonth(anchorDate);
  const currentStart = period === "week" ? startOfWeek(today, { weekStartsOn: 1 }) : startOfMonth(today);
  return isSameDay(start, currentStart);
}

export function buildAthleteKpiReport(
  rows: StatsActivityRow[],
  period: KpiPeriod,
  now = new Date(),
  sportFilter?: string
): AthleteKpiReport {
  const currentWindow = getCurrentPeriodWindow(period, now);
  const previousWindow = getPreviousPeriodWindow(period, currentWindow);
  const normalizedRows = rows.map(normalizeActivity);
  const currentRows = normalizedRows.filter((row) => isWithinWindow(row.sessionDate, currentWindow));
  const previousRows = normalizedRows.filter((row) => isWithinWindow(row.sessionDate, previousWindow));

  // Sport filter applies only to KPI cards (+ deltas)
  const applySportFilter = sportFilter && sportFilter !== "TOUT";
  const kpiCurrentRows = applySportFilter
    ? currentRows.filter((row) => row.sportKey === sportFilter)
    : currentRows;
  const kpiPreviousRows = applySportFilter
    ? previousRows.filter((row) => row.sportKey === sportFilter)
    : previousRows;

  const { insights, focusAlert } = generateInsights(currentRows, previousRows);
  const availableSports = [...new Set(currentRows.map((row) => row.sportKey))];

  return {
    period,
    periodLabel: buildPeriodLabel(period, now),
    currentRangeLabel: formatRangeLabel(currentWindow),
    comparisonRangeLabel: formatRangeLabel(previousWindow),
    cards: buildKpiCards(kpiCurrentRows, kpiPreviousRows),
    distribution: buildDistribution(currentRows),
    weeklyLoad: buildWeeklyLoad(normalizedRows, now),
    sportDecoupling: buildSportDecoupling(currentRows),
    insights,
    focusAlert,
    hrZones: aggregateHrZones(currentRows),
    availableSports,
  };
}
