import type { DailyReadiness } from "@/types/readiness";

export const HRV_ROLLING_DAYS = 7;
export const SWC_BASELINE_DAYS = 28;
export const MIN_HRV_ROLLING_POINTS = 4;
export const MIN_SWC_POINTS = 7;

export type HrvSwcStatus =
  | "within_swc"
  | "below_swc"
  | "above_swc"
  | "insufficient_data";

export interface ParsedHrvImportRow {
  date: string;
  time: string | null;
  rmssd: number | null;
  resting_hr: number | null;
  sleep_duration: number | null;
  sleep_quality: number | null;
  mental_energy: number | null;
  fatigue: number | null;
  lifestyle: number | null;
  muscle_soreness: number | null;
  physical_condition: number | null;
  training_performance: number | null;
  training_rpe: number | null;
  recovery_points: number | null;
  sickness: string | null;
  alcohol: string | null;
  sleep_score: null;
}

export interface DerivedHrvPoint extends DailyReadiness {
  ln_rmssd: number | null;
  ln_rmssd_7d_avg: number | null;
  swc_mean_28d: number | null;
  swc_low_28d: number | null;
  swc_high_28d: number | null;
  swc_status: HrvSwcStatus;
  swc_recommendation: "low/rest" | "normal" | null;
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  columns.push(current);
  return columns;
}

function detectDashDateFormat(values: string[]): "ymd" | "ydm" {
  for (const value of values) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) continue;

    const middle = Number(match[2]);
    const last = Number(match[3]);

    if (middle > 12 && last <= 12) return "ydm";
    if (last > 12 && middle <= 12) return "ymd";
  }

  return "ydm";
}

function normalizeImportDate(rawValue: string, detectedFormat: "ymd" | "ydm"): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const first = isoMatch[2];
    const second = isoMatch[3];
    const month = detectedFormat === "ydm" ? second : first;
    const day = detectedFormat === "ydm" ? first : second;
    return `${year}-${month}-${day}`;
  }

  const frMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }

  return null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSleepDuration(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hhmmMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    return Number((hours + minutes / 60).toFixed(2));
  }

  return parseNumber(trimmed);
}

function parseText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function roundOrNull(value: number | null, digits = 3): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export function parseHrvCsv(text: string): ParsedHrvImportRow[] {
  const todayIso = getTodayIsoDate();
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\uFEFF/g, ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Le fichier HRV4Training est vide ou incomplet.");
  }

  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["date", "HR", "rMSSD"];

  for (const header of requiredHeaders) {
    if (!headerIndex.has(header)) {
      throw new Error(`Colonne HRV4Training manquante: ${header}`);
    }
  }

  const rawRows = lines.slice(1).map((line) => {
    const columns = parseCsvLine(line).map((column) => column.trim());
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = columns[index] ?? "";
      return row;
    }, {});
  });

  const detectedFormat = detectDashDateFormat(
    rawRows.map((row) => row.date ?? row.local ?? "")
  );

  return rawRows
    .map((row) => {
      const date = normalizeImportDate(row.date ?? row.local ?? "", detectedFormat);
      if (!date || date > todayIso) return null;

      return {
        date,
        time: row.time?.trim() || null,
        rmssd: parseNumber(row.rMSSD),
        resting_hr: parseNumber(row.HR),
        sleep_duration: parseSleepDuration(row.sleep_time),
        sleep_quality: parseNumber(row.sleep_quality),
        mental_energy: parseNumber(row.mental_energy),
        fatigue: parseNumber(row.fatigue),
        lifestyle: parseNumber(row.lifestyle),
        muscle_soreness: parseNumber(row.muscle_soreness),
        physical_condition: parseNumber(row.physical_condition),
        training_performance: parseNumber(row.training_performance),
        training_rpe: parseNumber(row.trainingRPE),
        recovery_points: parseNumber(row.HRV4T_Recovery_Points),
        sickness: parseText(row.sickness),
        alcohol: parseText(row.alcohol),
        sleep_score: null,
      } satisfies ParsedHrvImportRow;
    })
    .filter(
      (row): row is ParsedHrvImportRow =>
        row !== null &&
        (row.rmssd !== null ||
          row.resting_hr !== null ||
          row.sleep_duration !== null ||
          row.sleep_quality !== null ||
          row.mental_energy !== null ||
          row.fatigue !== null ||
          row.lifestyle !== null ||
          row.muscle_soreness !== null ||
          row.physical_condition !== null ||
          row.training_performance !== null ||
          row.training_rpe !== null ||
          row.recovery_points !== null ||
          row.sickness !== null ||
          row.alcohol !== null)
    );
}

export function toLnRmssd(rmssd: number | null): number | null {
  if (rmssd === null || rmssd <= 0) return null;
  return Math.log(rmssd);
}

export function buildHrvTimeline(rows: DailyReadiness[]): DerivedHrvPoint[] {
  const todayIso = getTodayIsoDate();
  const sortedRows = [...rows].sort((left, right) =>
    left.date.localeCompare(right.date)
  ).filter((row) => row.date <= todayIso);

  return sortedRows.map((row) => {
    const currentDate = parseIsoDate(row.date);

    const rollingLnValues = sortedRows
      .filter((candidate) => {
        const candidateDate = parseIsoDate(candidate.date);
        const dayDiff =
          (currentDate.getTime() - candidateDate.getTime()) / 86_400_000;

        return dayDiff >= 0 && dayDiff < HRV_ROLLING_DAYS;
      })
      .map((candidate) => toLnRmssd(candidate.rmssd))
      .filter((value): value is number => value !== null);

    const swcBaselineValues = sortedRows
      .filter((candidate) => {
        const candidateDate = parseIsoDate(candidate.date);
        const dayDiff =
          (currentDate.getTime() - candidateDate.getTime()) / 86_400_000;

        return dayDiff > 0 && dayDiff <= SWC_BASELINE_DAYS;
      })
      .map((candidate) => toLnRmssd(candidate.rmssd))
      .filter((value): value is number => value !== null);

    const lnRmssd7dAvg =
      rollingLnValues.length >= MIN_HRV_ROLLING_POINTS
        ? average(rollingLnValues)
        : null;

    const swcMean =
      swcBaselineValues.length >= MIN_SWC_POINTS
        ? average(swcBaselineValues)
        : null;
    const swcSd =
      swcBaselineValues.length >= MIN_SWC_POINTS
        ? sampleStandardDeviation(swcBaselineValues)
        : null;

    const swcLow =
      swcMean !== null && swcSd !== null ? swcMean - 0.5 * swcSd : null;
    const swcHigh =
      swcMean !== null && swcSd !== null ? swcMean + 0.5 * swcSd : null;

    let swcStatus: HrvSwcStatus = "insufficient_data";
    if (
      lnRmssd7dAvg !== null &&
      swcLow !== null &&
      swcHigh !== null
    ) {
      if (lnRmssd7dAvg < swcLow) {
        swcStatus = "below_swc";
      } else if (lnRmssd7dAvg > swcHigh) {
        swcStatus = "above_swc";
      } else {
        swcStatus = "within_swc";
      }
    }

    return {
      ...row,
      ln_rmssd: roundOrNull(toLnRmssd(row.rmssd)),
      ln_rmssd_7d_avg: roundOrNull(lnRmssd7dAvg),
      swc_mean_28d: roundOrNull(swcMean),
      swc_low_28d: roundOrNull(swcLow),
      swc_high_28d: roundOrNull(swcHigh),
      swc_status: swcStatus,
      swc_recommendation:
        swcStatus === "above_swc" || swcStatus === "below_swc"
          ? "low/rest"
          : swcStatus === "within_swc"
            ? "normal"
            : null,
    };
  });
}

export function computeTrend(
  current: number | null,
  avg30d: number | null
): number | null {
  if (!current || !avg30d || avg30d === 0) return null;
  return ((current - avg30d) / avg30d) * 100;
}
