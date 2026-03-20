import { useState, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SegmentPhaseMetrics } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  LabelList,
  CartesianGrid,
} from "recharts";
import { kmhToPace } from "@/services/format.service";

interface Props {
  splits4: Record<string, SegmentPhaseMetrics> | null | undefined;
  sportType: string;
  phaseLabels?: string[];
}

interface SegmentChartPoint {
  label: string;
  fc_norm: number;
  allure_norm: number;
  ratio_norm: number;
  fc_abs: string;
  allure_abs: string;
  ratio_abs: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);
const DEFAULT_LABELS = ["Q1", "Q2", "Q3", "Q4"];
const PHASE_KEYS = ["phase_1", "phase_2", "phase_3", "phase_4"];
const TOOLTIP_W = 176;
const GAP = 50;

export function TempoSegmentAnalysis({ splits4, sportType, phaseLabels, hideTitle }: Props & { hideTitle?: boolean }) {
  const [activeSegment, setActiveSegment] = useState<{ point: SegmentChartPoint; cx: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Detect degradation
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

  const ref1 = phases[0];
  const chartData: SegmentChartPoint[] = phases
    .map((phase, i) => {
      if (!phase) return null;
      const fcNorm = ref1?.hr && phase.hr ? phase.hr / ref1.hr : 1;
      const allureNorm =
        ref1?.speed && phase.speed
          ? phase.speed / ref1.speed
          : ref1?.power && phase.power
          ? phase.power / ref1.power
          : 1;
      const ratioNorm = ref1?.ratio && phase.ratio ? phase.ratio / ref1.ratio : 1;
      return {
        label: labels[i],
        fc_norm: Math.round(fcNorm * 1000) / 1000,
        allure_norm: Math.round(allureNorm * 1000) / 1000,
        ratio_norm: Math.round(ratioNorm * 1000) / 1000,
        fc_abs: phase.hr != null ? `${Math.round(phase.hr)} bpm` : "--",
        allure_abs: isBike
          ? phase.power != null ? `${Math.round(phase.power)} W` : "--"
          : kmhToPace(phase.speed),
        ratio_abs: phase.ratio != null ? phase.ratio.toFixed(3) : "--",
      };
    })
    .filter(Boolean) as SegmentChartPoint[];

  // Position tooltip: right of the group center; flip left if it overflows
  let tooltipX = 0;
  if (activeSegment) {
    const containerW = containerRef.current?.offsetWidth ?? 800;
    const rightPos = activeSegment.cx + GAP;
    if (rightPos + TOOLTIP_W > containerW) {
      tooltipX = activeSegment.cx - TOOLTIP_W - GAP;
    } else {
      tooltipX = rightPos;
    }
    tooltipX = Math.max(0, tooltipX);
  }

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Analyse par segments
        </h3>
      )}

      <div ref={containerRef} className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 10, left: -10, bottom: 5 }}
            barGap={2}
            barCategoryGap="25%"
            onMouseMove={(state: any) => {
              if (state.activePayload?.length) {
                const point = state.activePayload[0].payload as SegmentChartPoint;
                setActiveSegment({ point, cx: state.activeCoordinate?.x ?? 0 });
              }
            }}
            onMouseLeave={() => setActiveSegment(null)}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:opacity-20" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(name: string) =>
                name === "fc_norm" ? "FC"
                  : name === "allure_norm" ? (isBike ? "Puissance" : "Allure")
                  : "Ratio"
              }
            />
            <Bar dataKey="fc_norm" name="fc_norm" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={28}>
              <LabelList dataKey="fc_norm" position="top" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 10, fill: "#3b82f6" }} />
            </Bar>
            <Bar dataKey="allure_norm" name="allure_norm" fill="#f97316" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={28}>
              <LabelList dataKey="allure_norm" position="top" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 10, fill: "#f97316" }} />
            </Bar>
            <Bar dataKey="ratio_norm" name="ratio_norm" fill="#22c55e" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={28}>
              <LabelList dataKey="ratio_norm" position="top" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 10, fill: "#22c55e" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {activeSegment && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-44 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{ left: tooltipX }}
          >
            <p className="mb-2 font-semibold text-slate-900 dark:text-white">{activeSegment.point.label}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[#3b82f6]" />
                <span className="text-slate-500">FC</span>
                <span className="ml-auto font-mono font-medium text-slate-900 dark:text-white">{activeSegment.point.fc_abs}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[#f97316]" />
                <span className="text-slate-500">{isBike ? "Puissance" : "Allure"}</span>
                <span className="ml-auto font-mono font-medium text-slate-900 dark:text-white">{activeSegment.point.allure_abs}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[#22c55e]" />
                <span className="text-slate-500">Ratio</span>
                <span className="ml-auto font-mono font-medium text-slate-900 dark:text-white">{activeSegment.point.ratio_abs}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {degradationSegment != null && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-900/20">
          <Icon name="warning" className="mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Dégradation progressive détectée — la fatigue s&apos;est installée à partir du segment {labels[degradationSegment - 1]}.
          </p>
        </div>
      )}
    </div>
  );
}
