import { useState, useRef } from "react";
import type { SegmentPhaseMetrics } from "@/types/activity";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import { kmhToPace } from "@/services/format.service";

interface Props {
  splits2: Record<string, SegmentPhaseMetrics> | null | undefined;
  sportType: string;
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
const TOOLTIP_W = 176;
const GAP = 50;

export function TempoPhaseComparison({ splits2, sportType, hideTitle }: Props & { hideTitle?: boolean }) {
  const [activeSegment, setActiveSegment] = useState<{ point: SegmentChartPoint; cx: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const phase1 = splits2?.phase_1;
  const phase2 = splits2?.phase_2;
  const isBike = BIKE_SPORTS.has(sportType);

  if (!phase1 && !phase2) return null;

  const ref1 = phase1;
  const phases = [
    { label: "1re moitié", phase: phase1 },
    { label: "2e moitié", phase: phase2 },
  ];

  const chartData: SegmentChartPoint[] = phases
    .map(({ label, phase }) => {
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
        label,
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
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Comparaison 1re vs 2e moitié
        </h3>
      )}
      <div ref={containerRef} className="relative h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 10, left: -10, bottom: 5 }}
            barGap={2}
            barCategoryGap="30%"
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
            <Bar dataKey="fc_norm" name="fc_norm" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={36}>
              <LabelList dataKey="fc_norm" position="top" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 10, fill: "#3b82f6" }} />
            </Bar>
            <Bar dataKey="allure_norm" name="allure_norm" fill="#f97316" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={36}>
              <LabelList dataKey="allure_norm" position="top" formatter={(v: number) => v.toFixed(2)} style={{ fontSize: 10, fill: "#f97316" }} />
            </Bar>
            <Bar dataKey="ratio_norm" name="ratio_norm" fill="#22c55e" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={36}>
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
    </div>
  );
}
