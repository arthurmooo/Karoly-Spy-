import { speedToPace, formatDuration, formatDistance } from "./format.service";

const SPORT_LABELS: Record<string, string> = {
  CAP: "Course",
  VELO: "Vélo",
  NAT: "Natation",
  SKI: "Ski de fond",
  TRI: "Triathlon",
  MUSC: "Musculation",
};

const WORK_TYPE_LABELS: Record<string, string> = {
  endurance: "Endurance",
  intervals: "Fractionné",
  competition: "Compétition",
};

export function mapSportLabel(sport: string): string {
  return SPORT_LABELS[sport] ?? sport;
}

export function mapWorkTypeLabel(workType: string | null): string {
  if (!workType) return "--";
  return WORK_TYPE_LABELS[workType] ?? workType;
}

export function formatPaceOrPower(
  sport: string,
  avgSpeed: number | null,
  avgPower: number | null
): string {
  if (sport === "VELO" || sport === "VTT") {
    return avgPower ? `${Math.round(avgPower)} W` : "--";
  }
  // Run / swim / etc. → pace
  return avgSpeed ? speedToPace(avgSpeed) : "--";
}

export function formatActivityRow(row: Record<string, unknown>) {
  const athletes = row.athletes as { first_name: string; last_name: string } | null;
  return {
    id: row.id as string,
    date: row.session_date as string,
    athlete: athletes
      ? `${athletes.first_name} ${(athletes.last_name as string).charAt(0)}.`
      : "Inconnu",
    athlete_id: row.athlete_id as string,
    sport: row.sport_type as string,
    work_type: mapWorkTypeLabel(row.work_type as string | null),
    duration: formatDuration((row.duration_sec as number) ?? 0),
    distance: formatDistance((row.distance_m as number) ?? 0),
    mls: row.load_index as number | null,
    hr: row.avg_hr ? `${Math.round(row.avg_hr as number)} bpm` : "--",
    pace: formatPaceOrPower(
      row.sport_type as string,
      row.distance_m && row.duration_sec
        ? (row.distance_m as number) / (row.duration_sec as number)
        : null,
      row.avg_power as number | null
    ),
  };
}
