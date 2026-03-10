import type { WeeklyMonitoringRow } from "@/repositories/load.repository";

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

const GLOBAL_FALLBACK_THRESHOLDS: MlsThresholds = { p25: 5000, p50: 15000, p75: 30000 };

function computePercentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const vlo = sorted[lo] ?? 0;
  const vhi = sorted[hi] ?? vlo;
  return vlo + (vhi - vlo) * (idx - lo);
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
