import type { SegmentPhaseMetrics } from "@/types/activity";

interface Props {
  splits2: Record<string, SegmentPhaseMetrics> | null | undefined;
  sportType: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

function formatPace(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

function formatMetric(value: number | null | undefined, unit: string): string {
  if (value == null) return "--";
  return `${value.toFixed(1)} ${unit}`;
}

export function TempoPhaseComparison({ splits2, sportType, hideTitle }: Props & { hideTitle?: boolean }) {
  const phase1 = splits2?.phase_1;
  const phase2 = splits2?.phase_2;
  const isBike = BIKE_SPORTS.has(sportType);

  if (!phase1 && !phase2) return null;

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Comparaison 1re vs 2e moitié
        </h3>
      )}
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
    </div>
  );
}
