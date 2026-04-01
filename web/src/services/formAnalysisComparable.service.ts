import type { Activity, FormAnalysis, FormAnalysisComparableActivity } from "@/types/activity";

export const DEFAULT_TEMP_BIN_WIDTH_C = 2.0;
export const DURATION_TOLERANCE_RATIO = 0.15;
export const OUTPUT_TOLERANCE_RATIO = 0.10;

export interface FormAnalysisHrKpi {
  label: "FC corrigée" | "FC brute";
  value: number | null;
  delta: number | null;
  tooltip: string;
  correctionApplied: boolean;
}

function safeNumber(value: number | null | undefined): number | null {
  return value == null || Number.isNaN(value) ? null : value;
}

function getFormAnalysisDuration(formAnalysis: FormAnalysis | null | undefined, activity: Pick<Activity, "duration_sec"> | Pick<FormAnalysisComparableActivity, "duration_sec">): number | null {
  return safeNumber(formAnalysis?.template?.duration_sec) ?? safeNumber(activity.duration_sec);
}

function getFormAnalysisOutput(formAnalysis: FormAnalysis | null | undefined): number | null {
  return safeNumber(formAnalysis?.output?.mean);
}

function getFormAnalysisTemperature(
  formAnalysis: FormAnalysis | null | undefined,
  activity: Pick<Activity, "temp_avg"> | Pick<FormAnalysisComparableActivity, "temp_avg">
): number | null {
  return safeNumber(formAnalysis?.temperature?.temp) ?? safeNumber(activity.temp_avg);
}

export function hasTemperatureCorrection(formAnalysis: FormAnalysis | null | undefined): boolean {
  return formAnalysis?.comparison_mode === "beta_regression" && safeNumber(formAnalysis.temperature?.beta_hr) != null;
}

export function getFormAnalysisHeartRateKpi(formAnalysis: FormAnalysis | null | undefined): FormAnalysisHrKpi {
  const correctionApplied = hasTemperatureCorrection(formAnalysis);
  if (correctionApplied) {
    return {
      label: "FC corrigée",
      value: safeNumber(formAnalysis?.temperature?.hr_corr),
      delta: safeNumber(formAnalysis?.temperature?.delta_hr_corr),
      correctionApplied: true,
      tooltip: "Fréquence cardiaque ajustée selon la température du jour (bpm). Permet de comparer des séances par temps chaud ou froid sur la même base.",
    };
  }

  return {
    label: "FC brute",
    value: safeNumber(formAnalysis?.temperature?.hr_mean_raw) ?? safeNumber(formAnalysis?.temperature?.hr_corr),
    delta: null,
    correctionApplied: false,
    tooltip: "Fréquence cardiaque observée sans correction température. Utilisée quand la correction n'est pas disponible ou non applicable.",
  };
}

export function isComparableFormAnalysisActivity(
  currentActivity: Activity,
  candidate: FormAnalysisComparableActivity
): boolean {
  const currentFa = currentActivity.form_analysis;
  const candidateFa = candidate.form_analysis;

  if (!currentFa || !candidateFa) return false;
  if (candidateFa.version !== currentFa.version) return false;
  if (candidateFa.module !== currentFa.module) return false;
  if (candidateFa.template_key !== currentFa.template_key) return false;

  const currentDuration = getFormAnalysisDuration(currentFa, currentActivity);
  const candidateDuration = getFormAnalysisDuration(candidateFa, candidate);
  if (currentDuration != null && currentDuration > 0 && candidateDuration != null) {
    const ratio = Math.abs(candidateDuration - currentDuration) / currentDuration;
    if (ratio > DURATION_TOLERANCE_RATIO) return false;
  }

  const currentOutput = getFormAnalysisOutput(currentFa);
  const candidateOutput = getFormAnalysisOutput(candidateFa);
  if (currentOutput != null && currentOutput > 0 && candidateOutput != null) {
    const ratio = Math.abs(candidateOutput - currentOutput) / currentOutput;
    if (ratio > OUTPUT_TOLERANCE_RATIO) return false;
  }

  if (currentFa.comparison_mode === "same_temp_bin") {
    const currentTemp = getFormAnalysisTemperature(currentFa, currentActivity);
    if (currentTemp != null) {
      const candidateTemp = getFormAnalysisTemperature(candidateFa, candidate);
      const tempBinWidth = safeNumber(currentFa.temperature?.temp_bin_width_c) ?? DEFAULT_TEMP_BIN_WIDTH_C;
      if (candidateTemp == null || Math.abs(candidateTemp - currentTemp) > tempBinWidth) return false;
    }
  }

  return true;
}

export function selectComparableFormAnalysisActivities(
  currentActivity: Activity,
  candidates: FormAnalysisComparableActivity[]
): FormAnalysisComparableActivity[] {
  const comparableCount = currentActivity.form_analysis?.comparable_count ?? 0;
  if (!currentActivity.form_analysis || comparableCount <= 0) return [];

  return candidates
    .filter((candidate) => isComparableFormAnalysisActivity(currentActivity, candidate))
    .sort((left, right) => new Date(right.session_date).getTime() - new Date(left.session_date).getTime())
    .slice(0, comparableCount);
}
