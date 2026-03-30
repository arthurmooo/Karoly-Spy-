import { addDays, endOfWeek, parseISO, startOfWeek } from "date-fns";
import type { DailyLoadHistoryRow, WeeklyMonitoringRow } from "@/repositories/load.repository";
import type {
  ActivityLoadRow,
  AcwrDashboardSummary,
  AcwrDataSource,
  AthleteAcwrDetail,
  AcwrMetricKind,
  AcwrMetricSnapshot,
  AcwrSnapshotRow,
  AcwrStatus,
} from "@/types/acwr";

export interface HeatmapCellData {
  mls: number;
  heures: number | null;
  nb_seances: number | null;
  mls_moyen_intervalles: number | null;
}

export interface MlsThresholds {
  p25: number;
  p50: number;
  p75: number;
}

export type WeeklyHeatmapLevel =
  | "rest"
  | "low"
  | "moderate"
  | "high"
  | "very_high";

export interface WeeklyHeatmapActivity {
  id: string;
  name: string;
  sport: string;
  workType: string | null;
  mls: number;
  durationSec: number;
}

export interface WeeklyHeatmapDay {
  date: string;
  label: string;
  mls: number;
  durationSec: number;
  sessionCount: number;
  level: WeeklyHeatmapLevel;
  activities: WeeklyHeatmapActivity[];
}

export interface WeeklyHeatmapData {
  weekStart: string;
  weekEnd: string;
  days: WeeklyHeatmapDay[];
  thresholds: MlsThresholds;
}

const GLOBAL_FALLBACK_THRESHOLDS: MlsThresholds = { p25: 5000, p50: 15000, p75: 30000 };
const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;
const ACWR_ALERT_THRESHOLD = 1.5;
const ACWR_WARNING_THRESHOLD = 1.3;
const ACWR_OK_THRESHOLD = 0.8;

const ACWR_LABELS: Record<AcwrMetricKind, string> = {
  external: "Charge externe",
  internal: "Charge interne",
  global: "Charge globale",
};

function computePercentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const vlo = sorted[lo] ?? 0;
  const vhi = sorted[hi] ?? vlo;
  return vlo + (vhi - vlo) * (idx - lo);
}

function toLocalIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildThresholds(values: number[]): MlsThresholds {
  const sorted = [...values].filter((value) => value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return GLOBAL_FALLBACK_THRESHOLDS;

  return {
    p25: computePercentile(sorted, 25),
    p50: computePercentile(sorted, 50),
    p75: computePercentile(sorted, 75),
  };
}

export function getWeeklyHeatmapLevel(
  mls: number,
  thresholds: MlsThresholds
): WeeklyHeatmapLevel {
  if (!mls) return "rest";
  if (mls <= thresholds.p25) return "low";
  if (mls <= thresholds.p50) return "moderate";
  if (mls <= thresholds.p75) return "high";
  return "very_high";
}

export function buildHeatmapData(rows: WeeklyMonitoringRow[]) {
  const athleteMap = new Map<string, Map<string, HeatmapCellData>>();
  const weeks = new Set<string>();

  for (const row of rows) {
    if (!athleteMap.has(row.athlete)) {
      athleteMap.set(row.athlete, new Map());
    }
    athleteMap.get(row.athlete)!.set(row.week_start, {
      mls: row.mls_hebdo ?? 0,
      heures: row.heures_hebdo,
      nb_seances: row.nb_seances,
      mls_moyen_intervalles: row.mls_moyen_intervalles,
    });
    weeks.add(row.week_start);
  }

  const sortedWeeks = [...weeks].sort();
  const athletes = [...athleteMap.keys()].sort();

  // Pre-compute per-athlete thresholds from their non-zero weekly values
  const athleteThresholds = new Map<string, MlsThresholds>();
  for (const [athlete, weekMap] of athleteMap.entries()) {
    const nonZeroValues = [...weekMap.values()]
      .map((c) => c.mls)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (nonZeroValues.length < 2) {
      athleteThresholds.set(athlete, GLOBAL_FALLBACK_THRESHOLDS);
    } else {
      athleteThresholds.set(athlete, {
        p25: computePercentile(nonZeroValues, 25),
        p50: computePercentile(nonZeroValues, 50),
        p75: computePercentile(nonZeroValues, 75),
      });
    }
  }

  return {
    athletes,
    weeks: sortedWeeks,
    getValue: (athlete: string, week: string) =>
      athleteMap.get(athlete)?.get(week)?.mls ?? 0,
    getCell: (athlete: string, week: string): HeatmapCellData | null =>
      athleteMap.get(athlete)?.get(week) ?? null,
    getAthleteThresholds: (athlete: string): MlsThresholds =>
      athleteThresholds.get(athlete) ?? GLOBAL_FALLBACK_THRESHOLDS,
  };
}

export function buildWeeklyHeatmapData(
  rows: DailyLoadHistoryRow[],
  anchorDate: string
): WeeklyHeatmapData {
  const anchor = parseISO(anchorDate);
  const weekStartDate = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(anchor, { weekStartsOn: 1 });
  const dayMap = new Map<string, { mls: number; durationSec: number; sessionCount: number }>();
  const activityMap = new Map<string, WeeklyHeatmapActivity[]>();

  for (const row of rows) {
    const localDate = toLocalIsoDate(new Date(row.session_date));
    const current = dayMap.get(localDate) ?? { mls: 0, durationSec: 0, sessionCount: 0 };
    current.mls += row.load_index ?? 0;
    current.durationSec += row.duration_sec ?? 0;
    current.sessionCount += 1;
    dayMap.set(localDate, current);

    const activities = activityMap.get(localDate) ?? [];
    activities.push({
      id: row.id,
      name: row.activity_name ?? "Séance",
      sport: row.sport_type ?? "",
      workType: row.work_type ?? null,
      mls: row.load_index ?? 0,
      durationSec: row.duration_sec ?? 0,
    });
    activityMap.set(localDate, activities);
  }

  const thresholds = buildThresholds(
    [...dayMap.values()].map((entry) => entry.mls)
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const currentDate = addDays(weekStartDate, index);
    const isoDate = toLocalIsoDate(currentDate);
    const aggregated = dayMap.get(isoDate) ?? { mls: 0, durationSec: 0, sessionCount: 0 };

    return {
      date: isoDate,
      label: DAY_LABELS[currentDate.getDay()] ?? "",
      mls: aggregated.mls,
      durationSec: aggregated.durationSec,
      sessionCount: aggregated.sessionCount,
      level: getWeeklyHeatmapLevel(aggregated.mls, thresholds),
      activities: activityMap.get(isoDate) ?? [],
    };
  });

  return {
    weekStart: toLocalIsoDate(weekStartDate),
    weekEnd: toLocalIsoDate(weekEndDate),
    days,
    thresholds,
  };
}

function round1(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(1));
}

function round2(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(2));
}

export function getAcwrStatus(
  ratio: number | null,
  insufficientData = false
): AcwrStatus {
  if (insufficientData || ratio === null || !Number.isFinite(ratio)) {
    return "insufficient_data";
  }
  if (ratio > ACWR_ALERT_THRESHOLD) return "alert";
  if (ratio >= ACWR_WARNING_THRESHOLD) return "warning";
  if (ratio >= ACWR_OK_THRESHOLD) return "ok";
  return "low";
}

function toUtcDayStart(input: string | Date): Date {
  const value = input instanceof Date ? input : new Date(input);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function getDayDiffFrom(referenceDay: Date, candidate: string): number {
  const candidateDay = toUtcDayStart(candidate);
  return Math.round((referenceDay.getTime() - candidateDay.getTime()) / (24 * 60 * 60 * 1000));
}

function getActiveDurationMinutes(row: ActivityLoadRow): number | null {
  const durationSec = row.moving_time_sec ?? row.duration_sec;
  if (durationSec == null || durationSec <= 0) return null;
  return durationSec / 60;
}

function getPhase1Load(kind: AcwrMetricKind, row: ActivityLoadRow): number | null {
  if (kind === "external") {
    return getActiveDurationMinutes(row);
  }

  if (kind === "internal") {
    const activeMinutes = getActiveDurationMinutes(row);
    if (activeMinutes == null || row.rpe == null) return null;
    return activeMinutes * row.rpe;
  }

  return row.load_index;
}

function getMetricLoad(kind: AcwrMetricKind, row: ActivityLoadRow): number | null {
  if (row.data_source === "phase2_components") {
    if (kind === "external") return row.external_duration_min;
    if (kind === "internal") return row.internal_srpe_load;
    return row.global_mls ?? row.load_index;
  }

  return getPhase1Load(kind, row);
}

function getMetricNote(kind: AcwrMetricKind, dataSource: AcwrDataSource): string {
  if (dataSource === "phase2_components") {
    if (kind === "external") {
      return "Basé sur la durée active, distance et intensité de chaque séance.";
    }
    if (kind === "internal") {
      return "Basé sur l'effort perçu (sRPE) et la répartition des zones cardiaques.";
    }
    return "Charge globale basée sur l'indice MLS de chaque séance.";
  }

  if (kind === "external") return "Estimé à partir de la durée active des séances.";
  if (kind === "internal") return "Estimé à partir de la durée × effort perçu (RPE).";
  return "Charge globale estimée à partir du MLS existant.";
}

function buildMetricSnapshot(
  rows: ActivityLoadRow[],
  kind: AcwrMetricKind,
  referenceDay: Date
): AcwrMetricSnapshot {
  const in28d = rows.filter((row) => {
    const dayDiff = getDayDiffFrom(referenceDay, row.session_date);
    return dayDiff >= 0 && dayDiff <= 27;
  });
  const in7d = in28d.filter((row) => getDayDiffFrom(referenceDay, row.session_date) <= 6);

  const loads28d = in28d
    .map((row) => getMetricLoad(kind, row))
    .filter((value): value is number => value != null && Number.isFinite(value));
  const loads7d = in7d
    .map((row) => getMetricLoad(kind, row))
    .filter((value): value is number => value != null && Number.isFinite(value));

  const acuteSum = loads7d.reduce((sum, value) => sum + value, 0);
  const chronicSum = loads28d.reduce((sum, value) => sum + value, 0);
  const chronicWeeklyEquiv = chronicSum > 0 ? chronicSum / 4 : null;
  const ratio = chronicWeeklyEquiv && chronicWeeklyEquiv > 0
    ? acuteSum / chronicWeeklyEquiv
    : null;

  const totalSessions28d = in28d.length;
  const validSessions28d = loads28d.length;
  const coveragePct = totalSessions28d > 0
    ? (validSessions28d / totalSessions28d) * 100
    : null;
  const insufficientData = kind === "internal"
    ? validSessions28d < 3 || chronicWeeklyEquiv == null
    : chronicWeeklyEquiv == null;
  const dataSource = rows.some((row) => row.data_source === "phase2_components")
    ? "phase2_components"
    : "phase1_proxy";

  return {
    kind,
    label: ACWR_LABELS[kind],
    acute_7d: round1(acuteSum),
    chronic_28d_weekly_equiv: round1(chronicWeeklyEquiv),
    ratio: round2(ratio),
    status: getAcwrStatus(ratio, insufficientData),
    coverage_pct: round1(coveragePct),
    valid_sessions_28d: validSessions28d,
    total_sessions_28d: totalSessions28d,
    note: getMetricNote(kind, dataSource),
    data_source: dataSource,
  };
}

function getSnapshotPriority(row: AcwrSnapshotRow): AcwrStatus {
  const statuses = [row.external.status, row.internal.status, row.global.status];
  if (statuses.includes("alert")) return "alert";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("insufficient_data")) return "insufficient_data";
  if (statuses.includes("low")) return "low";
  return "ok";
}

export function buildAcwrSnapshotRows(
  rows: ActivityLoadRow[],
  referenceDate = new Date()
): AcwrSnapshotRow[] {
  const referenceDay = toUtcDayStart(referenceDate);
  const grouped = new Map<string, ActivityLoadRow[]>();

  for (const row of rows) {
    const dayDiff = getDayDiffFrom(referenceDay, row.session_date);
    if (dayDiff < 0 || dayDiff > 41) continue;

    if (!grouped.has(row.athlete_id)) {
      grouped.set(row.athlete_id, []);
    }
    grouped.get(row.athlete_id)?.push(row);
  }

  return [...grouped.entries()]
    .map(([athleteId, athleteRows]) => {
      const sortedRows = [...athleteRows].sort((left, right) =>
        right.session_date.localeCompare(left.session_date, "fr")
      );
      return {
        athlete_id: athleteId,
        athlete: sortedRows[0]?.athlete ?? "Athlète inconnu",
        latest_session_date: sortedRows[0]?.session_date ?? null,
        external: buildMetricSnapshot(sortedRows, "external", referenceDay),
        internal: buildMetricSnapshot(sortedRows, "internal", referenceDay),
        global: buildMetricSnapshot(sortedRows, "global", referenceDay),
      };
    })
    .sort((left, right) => left.athlete.localeCompare(right.athlete, "fr"));
}

export function buildAthleteAcwrDetail(
  rows: ActivityLoadRow[],
  athleteId: string,
  referenceDate = new Date()
): AthleteAcwrDetail | null {
  return buildAcwrSnapshotRows(rows, referenceDate).find((row) => row.athlete_id === athleteId) ?? null;
}

export function buildAcwrDashboardSummary(rows: AcwrSnapshotRow[]): AcwrDashboardSummary {
  return rows.reduce<AcwrDashboardSummary>(
    (summary, row) => {
      const status = getSnapshotPriority(row);
      if (status === "alert") summary.alertCount += 1;
      if (status === "warning") summary.warningCount += 1;
      if (status === "insufficient_data") summary.insufficientCount += 1;
      return summary;
    },
    { alertCount: 0, warningCount: 0, insufficientCount: 0 }
  );
}
