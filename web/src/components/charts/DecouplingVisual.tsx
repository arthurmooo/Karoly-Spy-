import { Icon } from "@/components/ui/Icon";
import {
  getDecouplingLabel,
  getDecouplingState,
  getDurabilityPenaltyLabel,
  getDurabilityPenaltyState,
} from "@/lib/karolyMetrics";
import type { SegmentPhaseMetrics } from "@/types/activity";

interface Props {
  splits2: Record<string, SegmentPhaseMetrics> | null | undefined;
  decouplingIndex: number | null | undefined;
  durabilityIndex: number | null | undefined;
  sportType: string;
}

function decouplingColor(value: number): string {
  switch (getDecouplingState(value)) {
    case "good":
      return "text-emerald-600 dark:text-emerald-400";
    case "moderate":
      return "text-amber-600 dark:text-amber-400";
    case "high":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-slate-600 dark:text-slate-300";
  }
}

function decouplingBg(value: number): string {
  switch (getDecouplingState(value)) {
    case "good":
      return "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50";
    case "moderate":
      return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50";
    case "high":
      return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50";
    default:
      return "bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-700/50";
  }
}

function durabilityPenaltyClasses(value: number): string {
  switch (getDurabilityPenaltyState(value)) {
    case "stable":
      return "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20";
    case "moderate":
      return "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20";
    case "high":
      return "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20";
    default:
      return "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40";
  }
}

export function DecouplingVisual({ splits2, decouplingIndex, durabilityIndex, hideTitle }: Props & { hideTitle?: boolean }) {
  const phase1 = splits2?.phase_1;
  const phase2 = splits2?.phase_2;

  if (!phase1 && !phase2 && decouplingIndex == null) return null;

  const hrDrift = phase1?.hr && phase2?.hr
    ? ((phase2.hr - phase1.hr) / phase1.hr) * 100
    : null;
  const speedDrift = phase1?.speed && phase2?.speed
    ? ((phase2.speed - phase1.speed) / phase1.speed) * 100
    : null;

  // Alert: FC drift > 5% with stable speed (< 3% change)
  const showDriftAlert = hrDrift != null && speedDrift != null
    && hrDrift > 5 && Math.abs(speedDrift) < 3;

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Découplage aérobie
        </h3>
      )}

      {/* Stats row: decoupling + durability side by side */}
      {(decouplingIndex != null || durabilityIndex != null) && (
        <div className="flex gap-3">
          {decouplingIndex != null && (
            <div className={`flex flex-col rounded-xl border px-3 py-2 ${decouplingBg(decouplingIndex)}`}>
              <span className={`text-2xl font-bold font-mono ${decouplingColor(decouplingIndex)}`}>
                {decouplingIndex.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {getDecouplingLabel(decouplingIndex)}
              </span>
            </div>
          )}
          {durabilityIndex != null && (
            <div className={`flex flex-col rounded-xl border px-3 py-2 ${durabilityPenaltyClasses(durabilityIndex)}`}>
              <span className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">
                {durabilityIndex.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Penalite durabilite · {getDurabilityPenaltyLabel(durabilityIndex)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Drift alert */}
      {showDriftAlert && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
          <Icon name="warning" className="mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            FC en hausse de {hrDrift!.toFixed(1)}% sur la 2e moitié malgré une allure stable
            ({speedDrift! > 0 ? "+" : ""}{speedDrift!.toFixed(1)}%).
            Signe de fatigue cardiovasculaire progressive.
          </p>
        </div>
      )}
    </div>
  );
}
