import { Icon } from "@/components/ui/Icon";
import type { SegmentPhaseMetrics } from "@/types/activity";

interface Props {
  splits2: Record<string, SegmentPhaseMetrics> | null | undefined;
  decouplingIndex: number | null | undefined;
  durabilityIndex: number | null | undefined;
  sportType: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

function formatMetric(value: number | null | undefined, unit: string): string {
  if (value == null) return "--";
  return `${value.toFixed(1)} ${unit}`;
}

function formatPace(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
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

export function DecouplingVisual({ splits2, decouplingIndex, durabilityIndex, sportType, hideTitle }: Props & { hideTitle?: boolean }) {
  const phase1 = splits2?.phase_1;
  const phase2 = splits2?.phase_2;
  const isBike = BIKE_SPORTS.has(sportType);

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

      {/* KPI badge */}
      {decouplingIndex != null && (
        <div className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 ${decouplingBg(Math.abs(decouplingIndex))}`}>
          <span className={`text-2xl font-bold font-mono ${decouplingColor(Math.abs(decouplingIndex))}`}>
            {decouplingIndex.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {Math.abs(decouplingIndex) < 5 ? "Bon couplage" : Math.abs(decouplingIndex) < 10 ? "Découplage modéré" : "Découplage significatif"}
          </span>
        </div>
      )}

      {/* 2-column comparison */}
      {(phase1 || phase2) && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "1re moitié", phase: phase1 },
            { label: "2e moitié", phase: phase2 },
          ].map(({ label, phase }) => (
            <div key={label} className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">FC</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {formatMetric(phase?.hr, "bpm")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBike ? "Puissance" : "Allure"}</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {isBike ? formatMetric(phase?.power, "W") : formatPace(phase?.speed)}
                  </span>
                </div>
                {phase?.ratio != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ratio</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                      {phase.ratio.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {durabilityIndex != null && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Indice de durabilité : <span className="font-mono font-medium">{durabilityIndex.toFixed(2)}</span>
        </p>
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
