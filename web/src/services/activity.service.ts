import { speedToPace, speedToSwimPace, formatDuration, formatDistance } from "./format.service";
import { sanitizeRpe } from "@/lib/rpe";

const SPORT_LABELS: Record<string, string> = {
  CAP: "Course",
  RUN: "Course",
  RUNNING: "Course",
  "COURSE À PIED": "Course",
  "COURSE A PIED": "Course",
  COURSE: "Course",
  BIKE: "Vélo",
  VELO: "Vélo",
  VÉLO: "Vélo",
  CYCLING: "Vélo",
  BICYCLE: "Vélo",
  SWIM: "Natation",
  NAT: "Natation",
  NATATION: "Natation",
  STRENGTH: "Musculation",
  SKI: "Ski de fond",
  TRI: "Triathlon",
  MUSC: "Musculation",
};

const SPORT_CANONICAL_KEYS: Record<string, string> = {
  CAP: "CAP",
  RUN: "CAP",
  RUNNING: "CAP",
  "COURSE À PIED": "CAP",
  "COURSE A PIED": "CAP",
  COURSE: "CAP",
  BIKE: "VELO",
  VELO: "VELO",
  VÉLO: "VELO",
  CYCLING: "VELO",
  BICYCLE: "VELO",
  VTT: "VELO",
  SWIM: "NAT",
  NAT: "NAT",
  NATATION: "NAT",
  STRENGTH: "MUSC",
  SKI: "SKI",
  TRI: "TRI",
  MUSC: "MUSC",
};

const WORK_TYPE_LABELS: Record<string, string> = {
  endurance: "Endurance",
  intervals: "Fractionné",
  competition: "Compétition",
};

export function mapSportLabel(sport: string): string {
  const normalized = sport.trim().toUpperCase();
  return SPORT_LABELS[normalized] ?? sport;
}

export function normalizeSportKey(sport: string): string {
  const normalized = sport.trim().toUpperCase();
  return SPORT_CANONICAL_KEYS[normalized] ?? normalized;
}

export function isSwimSport(sport: string | null | undefined): boolean {
  return normalizeSportKey(sport ?? "") === "NAT";
}

export function isBikeSport(sport: string | null | undefined): boolean {
  return normalizeSportKey(sport ?? "") === "VELO";
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
  if (isBikeSport(sport)) {
    return avgPower ? `${Math.round(avgPower)} W` : "--";
  }
  if (isSwimSport(sport)) {
    return avgSpeed ? speedToSwimPace(avgSpeed) : "--";
  }
  return avgSpeed ? speedToPace(avgSpeed) : "--";
}

export function isRunSport(sport: string | null | undefined): boolean {
  return normalizeSportKey(sport ?? "") === "CAP";
}

/**
 * Détecte si une séance est indoor et retourne un tag court.
 * - Vélo indoor (Home Trainer) → "(HT)"
 * - Course indoor (Tapis) → "(Tapis)"
 * - Sinon → null
 */
export function getIndoorTag(
  sportType: string,
  sourceSport?: string | null,
  activityName?: string | null
): string | null {
  const text = `${sourceSport ?? ""} ${activityName ?? ""}`.toLowerCase();
  if (isBikeSport(sportType)) {
    if (text.includes("home trainer") || text.includes("home-trainer") || text.includes("virtual ride")) {
      return "(HT)";
    }
  }
  if (isRunSport(sportType)) {
    if (text.includes("tapis")) {
      return "(Tapis)";
    }
  }
  return null;
}

export function isTempo(name: string | null | undefined): boolean {
  if (!name) return false;
  return /tempo/i.test(name);
}

export function formatActivityRow(row: Record<string, unknown>) {
  const athletes = row.athletes as { first_name: string; last_name: string } | null;
  const durationSec = (row.duration_sec as number | null) ?? 0;
  const distanceM = (row.distance_m as number | null) ?? 0;
  const avgSpeed = distanceM && durationSec ? distanceM / durationSec : null;
  const avgPower = row.avg_power as number | null;
  const sportType = (row.sport_type as string) ?? "";
  const normalizedSport = sportType.trim().toUpperCase();
  const sourceSport = (row.source_sport as string | null) ?? null;
  const activityName = (row.activity_name as string | null) ?? null;
  const sportLabel = mapSportLabel(sportType);
  const indoorTag = getIndoorTag(sportType, sourceSport, activityName);

  return {
    id: row.id as string,
    date: row.session_date as string,
    title: ((row.manual_activity_name as string | null) || activityName || "Séance")
      .trim(),
    athlete: athletes
      ? `${athletes.first_name} ${(athletes.last_name as string).charAt(0)}.`
      : "Inconnu",
    athlete_id: row.athlete_id as string,
    sportRaw: sportLabel,
    sport: indoorTag ? `${sportLabel} ${indoorTag}` : sportLabel,
    work_type: mapWorkTypeLabel(row.work_type as string | null),
    duration: formatDuration(durationSec),
    distance: formatDistance(distanceM),
    mls: row.load_index as number | null,
    hr: row.avg_hr ? `${Math.round(row.avg_hr as number)} bpm` : "--",
    pace: formatPaceOrPower(
      sportType,
      avgSpeed,
      avgPower
    ),
    rpe: sanitizeRpe(row.rpe as number | null),
    pace_sort_value:
      normalizedSport === "VELO" || normalizedSport === "VTT" || normalizedSport === "BIKE"
        ? avgPower
        : avgSpeed,
  };
}
