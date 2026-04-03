import {
  addDays,
  addMilliseconds,
  addMonths,
  addWeeks,
  endOfYear,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { fr } from "date-fns/locale";
import { isValidRpe, sanitizeRpe } from "@/lib/rpe";
import type { StatsActivityRow } from "@/repositories/stats.repository";
import { mapSportLabel, normalizeSportKey } from "@/services/activity.service";
import { formatHoursHuman } from "@/services/format.service";
import { generateInsights, type TextInsight, type FocusAlert } from "@/services/analysis.service";
import { HR_ZONE_COLORS } from "@/lib/constants";

export type KpiPeriod = "week" | "month" | "year";

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
  deltaPct: number | null;
  deltaDisplay: string | null;
}

export interface HeatmapCell {
  label: string;
  mls: number;
}

export interface VolumeHistoryPoint {
  label: string;
  hours: number;
}

export interface AthleteKpiReport {
  period: KpiPeriod;
  periodLabel: string;
  currentRangeLabel: string;
  comparisonRangeLabel: string;
  cards: KpiCard[];
  distribution: SportDistributionItem[];
  weeklyLoad: WeeklyLoadPoint[];
  volumeHistory: VolumeHistoryPoint[];
  detailHeatmap: HeatmapCell[];
  comparisonHeatmap: HeatmapCell[];
  sportDecoupling: SportDecouplingItem[];
  insights: TextInsight[];
  focusAlert: FocusAlert | null;
  hrZones: HrZonesAggregate | null;
  hrZonesBySport: Record<string, HrZonesAggregate>;
  availableSports: string[];
  sessions: NormalizedStatsActivity[];
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
  const start = getPeriodStart(period, now);
  const today = new Date();
  const periodEnd = getPeriodEnd(period, now);
  // If `now` falls in the real current period, cap at today (partial).
  // Otherwise (historical), use the full period end.
  const isCurrentPeriod = today >= start && today <= periodEnd;
  return {
    start,
    end: isCurrentPeriod ? today : periodEnd,
  };
}

function getPeriodStart(period: KpiPeriod, anchor: Date): Date {
  if (period === "week") return startOfWeek(anchor, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(anchor);
  return startOfYear(anchor);
}

function getPeriodEnd(period: KpiPeriod, anchor: Date): Date {
  if (period === "week") return endOfWeek(anchor, { weekStartsOn: 1 });
  if (period === "month") return endOfMonth(anchor);
  return endOfYear(anchor);
}

function getPreviousPeriodWindow(period: KpiPeriod, currentWindow: PeriodWindow): PeriodWindow {
  const previousStart =
    period === "week"
      ? subWeeks(currentWindow.start, 1)
      : period === "month"
        ? startOfMonth(subMonths(currentWindow.start, 1))
        : startOfYear(subYears(currentWindow.start, 1));
  const elapsedMs = Math.max(currentWindow.end.getTime() - currentWindow.start.getTime(), 0);
  const rawEnd = addMilliseconds(previousStart, elapsedMs);

  return {
    start: previousStart,
    end:
      period === "month" && rawEnd > endOfMonth(previousStart)
        ? endOfMonth(previousStart)
        : period === "year" && rawEnd > endOfYear(previousStart)
          ? endOfYear(previousStart)
          : rawEnd,
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
    rpe: sanitizeRpe(row.rpe),
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
      .filter((value): value is number => isValidRpe(value))
  );
  const previousRpe = mean(
    previousRows
      .map((row) => row.rpe)
      .filter((value): value is number => isValidRpe(value))
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
      displayValue: formatHoursHuman(currentHours),
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
      if (isValidRpe(row.rpe)) existing.rpeValues.push(row.rpe);
    } else {
      totals.set(row.sportKey, {
        label: row.sportLabel,
        durationSec: row.durationSec,
        distanceM: row.distanceM,
        rpeValues: isValidRpe(row.rpe) ? [row.rpe] : [],
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

function buildVolumeHistory(
  period: KpiPeriod,
  allRows: NormalizedStatsActivity[],
  now: Date,
): VolumeHistoryPoint[] {
  if (period === "week") {
    // Last 8 weeks — total hours per week
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 8 }, (_, i) => {
      const ws = subWeeks(currentWeekStart, 7 - i);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const hours = allRows
        .filter((r) => r.sessionDate >= ws && r.sessionDate <= we)
        .reduce((s, r) => s + r.durationSec, 0) / 3600;
      return {
        label: format(ws, "d MMM", { locale: fr }),
        hours: round1(hours),
      };
    });
  }
  if (period === "month") {
    // Last 8 months — total hours per month
    const currentMonthStart = startOfMonth(now);
    return Array.from({ length: 8 }, (_, i) => {
      const ms = subMonths(currentMonthStart, 7 - i);
      const me = endOfMonth(ms);
      const hours = allRows
        .filter((r) => r.sessionDate >= ms && r.sessionDate <= me)
        .reduce((s, r) => s + r.durationSec, 0) / 3600;
      return {
        label: format(ms, "MMM yy", { locale: fr }),
        hours: round1(hours),
      };
    });
  }

  // Last 8 years — total hours per year
  const currentYearStart = startOfYear(now);
  return Array.from({ length: 8 }, (_, i) => {
    const ys = startOfYear(subYears(currentYearStart, 7 - i));
    const ye = endOfYear(ys);
    const hours = allRows
      .filter((r) => r.sessionDate >= ys && r.sessionDate <= ye)
      .reduce((s, r) => s + r.durationSec, 0) / 3600;
    return {
      label: format(ys, "yyyy", { locale: fr }),
      hours: round1(hours),
    };
  });
}

function buildDetailHeatmap(
  period: KpiPeriod,
  currentRows: NormalizedStatsActivity[],
  now: Date,
): HeatmapCell[] {
  if (period === "week") {
    // 7 days (Mon→Sun) with daily MLS
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const dayStr = format(day, "yyyy-MM-dd");
      const dayMls = currentRows
        .filter((r) => format(r.sessionDate, "yyyy-MM-dd") === dayStr)
        .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
      return {
        label: format(day, "EEE d", { locale: fr }),
        mls: round1(dayMls),
      };
    });
  }
  if (period === "month") {
    // Month: 4-5 weeks within the month
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const cells: HeatmapCell[] = [];
    let ws = startOfWeek(monthStart, { weekStartsOn: 1 });
    while (ws <= monthEnd) {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const weekMls = currentRows
        .filter((r) => r.sessionDate >= ws && r.sessionDate <= we)
        .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
      cells.push({
        label: `${format(ws, "d", { locale: fr })}–${format(we, "d MMM", { locale: fr })}`,
        mls: round1(weekMls),
      });
      ws = addWeeks(ws, 1);
    }
    return cells;
  }

  // Year: 12 months within the year
  const yearStart = startOfYear(now);
  return Array.from({ length: 12 }, (_, i) => {
    const ms = startOfMonth(addMonths(yearStart, i));
    const me = endOfMonth(ms);
    const monthMls = currentRows
      .filter((r) => r.sessionDate >= ms && r.sessionDate <= me)
      .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
    return {
      label: format(ms, "MMM", { locale: fr }),
      mls: round1(monthMls),
    };
  });
}

function buildComparisonHeatmap(
  period: KpiPeriod,
  allRows: NormalizedStatsActivity[],
  now: Date,
): HeatmapCell[] {
  if (period === "week") {
    // Last 4 weeks (MLS per week)
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 4 }, (_, i) => {
      const ws = subWeeks(currentWeekStart, 3 - i);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const weekMls = allRows
        .filter((r) => r.sessionDate >= ws && r.sessionDate <= we)
        .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
      return {
        label: format(ws, "d MMM", { locale: fr }),
        mls: round1(weekMls),
      };
    });
  }
  if (period === "month") {
    // Last 4 months (MLS per month)
    const currentMonthStart = startOfMonth(now);
    return Array.from({ length: 4 }, (_, i) => {
      const ms = subMonths(currentMonthStart, 3 - i);
      const me = endOfMonth(ms);
      const monthMls = allRows
        .filter((r) => r.sessionDate >= ms && r.sessionDate <= me)
        .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
      return {
        label: format(ms, "MMM yy", { locale: fr }),
        mls: round1(monthMls),
      };
    });
  }

  // Last 4 years (MLS per year)
  const currentYearStart = startOfYear(now);
  return Array.from({ length: 4 }, (_, i) => {
    const ys = startOfYear(subYears(currentYearStart, 3 - i));
    const ye = endOfYear(ys);
    const yearMls = allRows
      .filter((r) => r.sessionDate >= ys && r.sessionDate <= ye)
      .reduce((s, r) => s + (r.loadIndex ?? 0), 0);
    return {
      label: format(ys, "yyyy", { locale: fr }),
      mls: round1(yearMls),
    };
  });
}

function buildSportDecoupling(
  currentRows: NormalizedStatsActivity[],
  previousRows: NormalizedStatsActivity[],
): SportDecouplingItem[] {
  const grouped = new Map<string, { label: string; sessionCount: number; decouplingValues: number[] }>();
  for (const row of currentRows) {
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

  // Previous period averages by sport
  const prevGrouped = new Map<string, number[]>();
  for (const row of previousRows) {
    const vals = prevGrouped.get(row.sportKey);
    if (row.decouplingIndex != null) {
      if (vals) vals.push(row.decouplingIndex);
      else prevGrouped.set(row.sportKey, [row.decouplingIndex]);
    }
  }

  return [...grouped.entries()]
    .map(([sportKey, value]) => {
      const avgDecoupling = mean(value.decouplingValues);
      const prevAvg = mean(prevGrouped.get(sportKey) ?? []);
      // Absolute delta in percentage points (not relative %)
      const absDelta = avgDecoupling != null && prevAvg != null ? round1(avgDecoupling - prevAvg) : null;
      return {
        sportKey,
        label: value.label,
        sessionCount: value.sessionCount,
        avgDecoupling: avgDecoupling != null ? round1(avgDecoupling) : null,
        displayValue: avgDecoupling != null ? `${ONE_DECIMAL.format(avgDecoupling)} %` : "--",
        deltaPct: absDelta,
        deltaDisplay: absDelta != null ? `${SIGNED_ONE_DECIMAL.format(absDelta)} %` : null,
      };
    })
    .sort((left, right) => right.sessionCount - left.sessionCount || left.label.localeCompare(right.label, "fr"));
}

export function getAthleteKpiFetchRange(period: KpiPeriod, now = new Date()): PeriodWindow {
  const currentWindow = getCurrentPeriodWindow(period, now);
  const previousWindow = getPreviousPeriodWindow(period, currentWindow);
  const weeklyStart = getOldestLoadWeekStart(now);
  const comparisonStart =
    period === "month"
      ? startOfMonth(subMonths(now, 7))
      : period === "year"
        ? startOfYear(subYears(now, 7))
        : weeklyStart;
  const earliest = [previousWindow.start, weeklyStart, comparisonStart].reduce(
    (min, d) => (d < min ? d : min)
  );

  return {
    start: earliest,
    end: currentWindow.end,
  };
}

export function getCurrentKpiPeriodWindow(period: KpiPeriod, now = new Date()): PeriodWindow {
  return getCurrentPeriodWindow(period, now);
}

export function buildPeriodLabel(period: KpiPeriod, now: Date): string {
  const today = new Date();
  const start = getPeriodStart(period, now);
  const currentStart = getPeriodStart(period, today);
  if (isSameDay(start, currentStart)) {
    if (period === "week") return "Cette semaine";
    if (period === "month") return "Ce mois-ci";
    return "Cette année";
  }
  if (period === "week") {
    return format(start, "'Semaine du' d MMMM yyyy", { locale: fr });
  }
  if (period === "month") {
    return format(start, "MMMM yyyy", { locale: fr });
  }
  return format(start, "yyyy", { locale: fr });
}

export function isCurrentPeriod(period: KpiPeriod, anchorDate: Date): boolean {
  const today = new Date();
  const start = getPeriodStart(period, anchorDate);
  const currentStart = getPeriodStart(period, today);
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

  // Per-sport HR zone aggregates
  const hrZonesBySport: Record<string, HrZonesAggregate> = {};
  const sportGroups = new Map<string, NormalizedStatsActivity[]>();
  for (const row of currentRows) {
    const group = sportGroups.get(row.sportKey);
    if (group) group.push(row);
    else sportGroups.set(row.sportKey, [row]);
  }
  for (const [sportKey, sportRows] of sportGroups) {
    const agg = aggregateHrZones(sportRows);
    if (agg) hrZonesBySport[sportKey] = agg;
  }

  return {
    period,
    periodLabel: buildPeriodLabel(period, now),
    currentRangeLabel: formatRangeLabel(currentWindow),
    comparisonRangeLabel: formatRangeLabel(previousWindow),
    cards: buildKpiCards(kpiCurrentRows, kpiPreviousRows),
    distribution: buildDistribution(currentRows),
    weeklyLoad: buildWeeklyLoad(normalizedRows, now),
    volumeHistory: buildVolumeHistory(period, normalizedRows, now),
    detailHeatmap: buildDetailHeatmap(period, currentRows, now),
    comparisonHeatmap: buildComparisonHeatmap(period, normalizedRows, now),
    sportDecoupling: buildSportDecoupling(currentRows, previousRows),
    insights,
    focusAlert,
    hrZones: aggregateHrZones(currentRows),
    hrZonesBySport,
    availableSports,
    sessions: [...kpiCurrentRows].sort(
      (a, b) => b.sessionDate.getTime() - a.sessionDate.getTime()
    ),
  };
}
