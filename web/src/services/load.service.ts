import type { WeeklyMonitoringRow } from "@/repositories/load.repository";

export interface HeatmapCell {
  athlete: string;
  weekStart: string;
  mls: number;
}

export function buildHeatmapData(rows: WeeklyMonitoringRow[]) {
  // Pivot: group by athlete, with weekly MLS values
  const athleteMap = new Map<string, Map<string, number>>();
  const weeks = new Set<string>();

  for (const row of rows) {
    if (!athleteMap.has(row.athlete)) {
      athleteMap.set(row.athlete, new Map());
    }
    athleteMap.get(row.athlete)!.set(row.week_start, row.mls_hebdo ?? 0);
    weeks.add(row.week_start);
  }

  const sortedWeeks = [...weeks].sort();
  const athletes = [...athleteMap.keys()].sort();

  return {
    athletes,
    weeks: sortedWeeks,
    getValue: (athlete: string, week: string) =>
      athleteMap.get(athlete)?.get(week) ?? 0,
  };
}
