import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { BlockGroupedIntervals, RepWindow } from "@/types/activity";
import type { PhysioProfile } from "@/types/physio";
import { formatPaceDecimal, speedToPaceDecimal } from "@/services/format.service";
import type { ViewMode } from "@/components/tables/IntervalDetailTable";

interface Props {
  intervalsByBlock: BlockGroupedIntervals[];
  repWindowsByBlock: Record<number, RepWindow[]>;
  viewMode: ViewMode;
  physioProfile: PhysioProfile | null;
  sportType: string;
  hideTitle?: boolean;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

interface IntervalChartPoint {
  index: number;
  hr: number | null;
  hrRaw?: number | null;
  hrCorr?: number | null;
  pace: number | null;
  power: number | null;
  output?: number | null;
  ea?: number | null;
}

interface IntervalChartModel {
  data: IntervalChartPoint[];
  blockBoundaries: { index: number; label: string }[];
  title: string;
  xAxisLabel: string;
  labelPrefix: string;
}

export function buildIntervalChartModel(
  intervalsByBlock: BlockGroupedIntervals[],
  repWindowsByBlock: Record<number, RepWindow[]>,
  isBike: boolean,
  viewMode: ViewMode,
): IntervalChartModel {
  const flat: IntervalChartPoint[] = [];
  const boundaries: { index: number; label: string }[] = [];
  let seqIdx = 0;

  for (let bIdx = 0; bIdx < intervalsByBlock.length; bIdx++) {
    const group = intervalsByBlock[bIdx]!;
    const windowRows = repWindowsByBlock[group.blockIndex] ?? [];
    const intervalRows = group.intervals.filter((i) => i.type === "work" || i.type === "active");
    const sourceRows = viewMode === "windows" ? windowRows : intervalRows;

    if (bIdx > 0 && sourceRows.length > 0) {
      boundaries.push({ index: seqIdx + 0.5, label: group.label });
    }

    if (viewMode === "windows") {
      for (const window of windowRows) {
        seqIdx++;
        flat.push({
          index: seqIdx,
          hr: window.hr_corr != null
            ? Math.round(window.hr_corr)
            : window.hr_raw != null
              ? Math.round(window.hr_raw)
              : null,
          hrRaw: window.hr_raw != null ? Math.round(window.hr_raw) : null,
          hrCorr: window.hr_corr != null ? Math.round(window.hr_corr) : null,
          pace: !isBike && window.output && window.output > 0 ? 60 / window.output : null,
          power: isBike && window.output != null ? Math.round(window.output) : null,
          output: window.output ?? null,
          ea: window.ea ?? null,
        });
      }
    } else {
      for (const intv of intervalRows) {
        seqIdx++;
        flat.push({
          index: seqIdx,
          hr: intv.avg_hr != null ? Math.round(intv.avg_hr) : null,
          pace: !isBike && intv.avg_speed && intv.avg_speed > 0
            ? speedToPaceDecimal(intv.avg_speed)
            : null,
          power: isBike && intv.avg_power ? Math.round(intv.avg_power) : null,
        });
      }
    }
  }

  return {
    data: flat,
    blockBoundaries: boundaries,
    title: viewMode === "windows" ? "Évolution par fenêtre stabilisée" : "Évolution par intervalle",
    xAxisLabel: viewMode === "windows" ? "N° fenêtre" : "N° intervalle",
    labelPrefix: viewMode === "windows" ? "Fenêtre" : "Intervalle",
  };
}

export function IntervalChart({
  intervalsByBlock,
  repWindowsByBlock,
  viewMode,
  physioProfile,
  sportType,
  hideTitle,
}: Props) {
  const isBike = BIKE_SPORTS.has(sportType);

  // Flatten all active intervals across blocks, tracking block boundaries
  const { data, blockBoundaries, title, xAxisLabel, labelPrefix } = useMemo(
    () => buildIntervalChartModel(intervalsByBlock, repWindowsByBlock, isBike, viewMode),
    [intervalsByBlock, repWindowsByBlock, isBike, viewMode]
  );

  if (data.length === 0) return null;

  const hrValues = data.map((d) => d.hr).filter((v): v is number => v != null);
  const hrMin = hrValues.length ? Math.floor(Math.min(...hrValues) / 10) * 10 - 10 : 80;
  const hrMax = hrValues.length ? Math.ceil(Math.max(...hrValues) / 10) * 10 + 10 : 200;

  const secondaryKey = isBike ? "power" : "pace";
  const secValues = data.map((d) => d[secondaryKey]).filter((v): v is number => v != null);
  const secMin = secValues.length ? Math.min(...secValues) : 0;
  const secMax = secValues.length ? Math.max(...secValues) : 10;
  const secPadding = isBike ? 20 : 0.3;

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </h3>
      )}
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} className="dark:opacity-20" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              label={{ value: xAxisLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis
              yAxisId="left"
              domain={[hrMin, hrMax]}
              tick={{ fontSize: 11, fill: "#F97316" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[secMin - secPadding, secMax + secPadding]}
              reversed={!isBike}
              tick={{ fontSize: 11, fill: "#2563EB" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={isBike ? (v: number) => `${v}W` : (v: number) => formatPaceDecimal(v)}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
              formatter={(value: number, name: string) => {
                if (name === "hr") return [`${value} bpm`, "FC"];
                if (name === "hrRaw") return [`${value} bpm`, "FC brute"];
                if (name === "hrCorr") return [`${value} bpm`, "FC corrigée"];
                if (name === "pace") return [formatPaceDecimal(value), "Allure"];
                if (name === "power") return [`${value} W`, "Puissance"];
                if (name === "output") return [isBike ? `${Math.round(value)} W` : formatPaceDecimal(60 / value), "Output"];
                if (name === "ea") return [value.toFixed(3), "EA"];
                return [value, name];
              }}
              labelFormatter={(l) => `${labelPrefix} ${l}`}
            />

            {/* Reference lines from physio profile */}
            {physioProfile?.lt1_hr && (
              <ReferenceLine yAxisId="left" y={physioProfile.lt1_hr} stroke="#4ade80" strokeDasharray="4 4" strokeWidth={1} label={{ value: "LT1", fontSize: 9, fill: "#4ade80", position: "right" }} />
            )}
            {physioProfile?.lt2_hr && (
              <ReferenceLine yAxisId="left" y={physioProfile.lt2_hr} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1} label={{ value: "LT2", fontSize: 9, fill: "#f97316", position: "right" }} />
            )}
            {physioProfile?.cp_cs && (
              <ReferenceLine
                yAxisId="right"
                y={isBike ? physioProfile.cp_cs : (physioProfile.cp_cs > 0 ? 1000 / physioProfile.cp_cs / 60 : null) as number}
                stroke="#2563EB"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: "CP/CS", fontSize: 9, fill: "#2563EB", position: "left" }}
              />
            )}

            {/* Block separators */}
            {blockBoundaries.map((boundary) => (
              <ReferenceLine
                key={`block-sep-${boundary.index}`}
                x={boundary.index}
                stroke="#94a3b8"
                strokeDasharray="6 4"
                strokeWidth={1}
                yAxisId="left"
                label={{ value: boundary.label, fontSize: 10, fill: "#94a3b8", position: "insideTopRight" }}
              />
            ))}

            {/* HR dots */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="hr"
              stroke="#F97316"
              strokeWidth={2}
              dot={{ r: 5, fill: "#F97316", strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              connectNulls
              isAnimationActive={false}
            />

            {/* Pace/Power dots */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={secondaryKey}
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 5, fill: "#2563EB", strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
