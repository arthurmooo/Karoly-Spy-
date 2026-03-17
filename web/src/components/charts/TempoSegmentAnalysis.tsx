import { Icon } from "@/components/ui/Icon";
import type { SegmentPhaseMetrics } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";

interface Props {
  splits4: Record<string, SegmentPhaseMetrics> | null | undefined;
  sportType: string;
  phaseLabels?: string[];
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

const DEFAULT_LABELS = ["Q1", "Q2", "Q3", "Q4"];
const PHASE_KEYS = ["phase_1", "phase_2", "phase_3", "phase_4"];

function formatPace(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "--";
  const paceSec = 1000 / ms;
  const min = Math.floor(paceSec / 60);
  const sec = Math.round(paceSec % 60);
  return `${min}'${sec.toString().padStart(2, "0")}`;
}

function driftColor(drift: number): string {
  if (Math.abs(drift) < 3) return "text-emerald-600 dark:text-emerald-400";
  if (Math.abs(drift) < 5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function driftBg(drift: number): string {
  if (Math.abs(drift) < 3) return "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20";
  if (Math.abs(drift) < 5) return "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20";
  return "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20";
}

export function TempoSegmentAnalysis({ splits4, sportType, phaseLabels, hideTitle }: Props & { hideTitle?: boolean }) {
  const isBike = BIKE_SPORTS.has(sportType);
  const labels = phaseLabels ?? DEFAULT_LABELS;

  if (!splits4) {
    return (
      <FeatureNotice
        title="Analyse par segments"
        description="Données de segmentation (splits_4) non disponibles pour cette séance."
        status="unavailable"
      />
    );
  }

  const phases = PHASE_KEYS.map((key) => splits4[key] ?? null);
  const validPhases = phases.filter(Boolean);
  if (validPhases.length === 0) {
    return (
      <FeatureNotice
        title="Analyse par segments"
        description="Aucun segment exploitable dans les données."
        status="unavailable"
      />
    );
  }

  // Detect degradation: find first segment where HR rises and speed drops significantly vs Q1
  const q1 = phases[0];
  let degradationSegment: number | null = null;
  if (q1?.hr && q1?.speed) {
    for (let i = 1; i < phases.length; i++) {
      const p = phases[i];
      if (!p?.hr || !p?.speed) continue;
      const hrDrift = ((p.hr - q1.hr) / q1.hr) * 100;
      const speedDrift = ((p.speed - q1.speed) / q1.speed) * 100;
      if (hrDrift > 3 && speedDrift < -2) {
        degradationSegment = i + 1;
        break;
      }
    }
  }

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Analyse par segments
        </h3>
      )}

      {/* 4 segment cards in grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {phases.map((phase, i) => {
          if (!phase) return null;

          // Drift vs Q1
          const hrDrift = q1?.hr && phase.hr ? ((phase.hr - q1.hr) / q1.hr) * 100 : null;
          const speedDrift = q1?.speed && phase.speed ? ((phase.speed - q1.speed) / q1.speed) * 100 : null;
          const maxDrift = Math.max(Math.abs(hrDrift ?? 0), Math.abs(speedDrift ?? 0));

          return (
            <div
              key={i}
              className={`rounded-sm border p-3 ${i === 0 ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" : driftBg(maxDrift)}`}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {labels[i]}
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">FC</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {phase.hr != null ? `${Math.round(phase.hr)} bpm` : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{isBike ? "Puiss." : "Allure"}</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {isBike
                      ? phase.power != null ? `${Math.round(phase.power)} W` : "--"
                      : formatPace(phase.speed)}
                  </span>
                </div>
                {phase.ratio != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ratio</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                      {phase.ratio.toFixed(3)}
                    </span>
                  </div>
                )}
                {i > 0 && hrDrift != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Δ FC</span>
                    <span className={`font-mono font-medium ${driftColor(hrDrift)}`}>
                      {hrDrift > 0 ? "+" : ""}{hrDrift.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Degradation alert */}
      {degradationSegment != null && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
          <Icon name="warning" className="mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Dégradation progressive détectée — la fatigue s'est installée à partir du segment {labels[degradationSegment - 1]}.
          </p>
        </div>
      )}
    </div>
  );
}
