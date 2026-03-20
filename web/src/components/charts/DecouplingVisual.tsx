import { Icon } from "@/components/ui/Icon";
import type { SegmentPhaseMetrics } from "@/types/activity";

interface Props {
  splits2: Record<string, SegmentPhaseMetrics> | null | undefined;
  decouplingIndex: number | null | undefined;
  durabilityIndex: number | null | undefined;
  sportType: string;
}

function decouplingColor(value: number): string {
  if (value < 5) return "text-emerald-600 dark:text-emerald-400";
  if (value < 10) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function decouplingBg(value: number): string {
  if (value < 5) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50";
  if (value < 10) return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50";
  return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50";
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
            <div className={`flex flex-col rounded-sm border px-3 py-2 ${decouplingBg(Math.abs(decouplingIndex))}`}>
              <span className={`text-2xl font-bold font-mono ${decouplingColor(Math.abs(decouplingIndex))}`}>
                {decouplingIndex.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {Math.abs(decouplingIndex) < 5 ? "Bon couplage" : Math.abs(decouplingIndex) < 10 ? "Découplage modéré" : "Découplage significatif"}
              </span>
            </div>
          )}
          {durabilityIndex != null && (
            <div className="flex flex-col rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
              <span className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">
                {durabilityIndex.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Durabilité</span>
            </div>
          )}
        </div>
      )}

      {/* Drift alert */}
      {showDriftAlert && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
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
