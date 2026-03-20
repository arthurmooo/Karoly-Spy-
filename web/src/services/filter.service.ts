export const SPORT_OPTIONS = [
  { value: "CAP", label: "Course à pied" },
  { value: "VELO", label: "Vélo" },
  { value: "NAT", label: "Natation" },
  { value: "SKI", label: "Ski de fond" },
  { value: "TRI", label: "Triathlon" },
  { value: "MUSC", label: "Musculation" },
];

export const WORK_TYPE_OPTIONS = [
  { value: "endurance", label: "Endurance" },
  { value: "competition", label: "Compétition" },
  { value: "intervals", label: "Fractionné" },
];

export const DURATION_OPTIONS = [
  { value: "0-30", label: "< 30 min" },
  { value: "30-60", label: "30 min – 1h" },
  { value: "60-120", label: "1h – 2h" },
  { value: "120-180", label: "2h – 3h" },
  { value: "180-", label: "> 3h" },
];


/**
 * Parse a duration range string (e.g. "60-120") into min/max in seconds.
 */
export function parseDurationRange(value: string): { min?: number; max?: number } {
  if (!value) return {};
  const parts = value.split("-");
  const minMinutes = parts[0] ? Number(parts[0]) : undefined;
  const maxMinutes = parts[1] ? Number(parts[1]) : undefined;

  return {
    min: minMinutes != null && Number.isFinite(minMinutes) ? minMinutes * 60 : undefined,
    max: maxMinutes != null && Number.isFinite(maxMinutes) ? maxMinutes * 60 : undefined,
  };
}
