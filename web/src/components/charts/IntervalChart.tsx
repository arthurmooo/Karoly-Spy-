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
import type { BlockGroupedIntervals, RepWindow, StreamPoint } from "@/types/activity";
import type { PhysioProfile } from "@/types/physio";
import { formatPaceDecimal, formatSwimPaceDecimal, speedToPaceDecimal, speedToSwimPaceDecimal } from "@/services/format.service";
import { getStreamPowerForRange, isBikeSport, isSwimSport } from "@/services/activity.service";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { ViewMode } from "@/components/tables/IntervalDetailTable";

interface Props {
  intervalsByBlock: BlockGroupedIntervals[];
  repWindowsByBlock: Record<number, RepWindow[]>;
  streams?: StreamPoint[] | null;
  viewMode: ViewMode;
  physioProfile: PhysioProfile | null;
  sportType: string;
  hideTitle?: boolean;
}

interface IntervalChartPoint {
  index: number;
  hr: number | null;
  hrRaw?: number | null;
  hrCorr?: number | null;
  pace: number | null;
  powerWithoutZeros: number | null;
  powerWithZeros: number | null;
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
  streams: StreamPoint[] | null | undefined,
  isBike: boolean,
  viewMode: ViewMode,
  isSwim = false,
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
          pace: !isBike && window.output && window.output > 0 ? (isSwim ? 6 / window.output : 60 / window.output) : null,
          powerWithoutZeros: isBike
            ? getStreamPowerForRange(streams, window.start_sec, window.end_sec, "elapsed_t", false)
            : null,
          powerWithZeros: isBike
            ? getStreamPowerForRange(streams, window.start_sec, window.end_sec, "elapsed_t", true)
            : null,
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
            ? (isSwim ? speedToSwimPaceDecimal(intv.avg_speed) : speedToPaceDecimal(intv.avg_speed))
            : null,
          powerWithoutZeros: isBike ? (intv.avg_power != null ? Math.round(intv.avg_power) : null) : null,
          powerWithZeros: isBike
            ? getStreamPowerForRange(streams, intv.start_time, intv.end_time, "elapsed_t", true)
            : null,
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
  streams,
  viewMode,
  physioProfile,
  sportType,
  hideTitle,
}: Props) {
  const isBike = isBikeSport(sportType);
  const isSwim = isSwimSport(sportType);
  const ct = useChartTheme();
  const fmtPace = isSwim ? formatSwimPaceDecimal : formatPaceDecimal;

  // Flatten all active intervals across blocks, tracking block boundaries
  const { data, blockBoundaries, title, xAxisLabel, labelPrefix } = useMemo(
    () => buildIntervalChartModel(intervalsByBlock, repWindowsByBlock, streams, isBike, viewMode, isSwim),
    [intervalsByBlock, repWindowsByBlock, streams, isBike, viewMode, isSwim]
  );

  if (data.length === 0) return null;

  const hrValues = data.map((d) => d.hr).filter((v): v is number => v != null);
  const hrMin = hrValues.length ? Math.floor(Math.min(...hrValues) / 10) * 10 - 10 : 80;
  const hrMax = hrValues.length ? Math.ceil(Math.max(...hrValues) / 10) * 10 + 10 : 200;

  const secValues = isBike
    ? data.flatMap((d) => [d.powerWithoutZeros, d.powerWithZeros]).filter((v): v is number => v != null)
    : data.map((d) => d.pace).filter((v): v is number => v != null);
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
            <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              label={{ value: xAxisLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: ct.tick }}
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
              tickFormatter={isBike ? (v: number) => `${v}W` : (v: number) => fmtPace(v)}
            />
            <Tooltip
              contentStyle={ct.tooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === "hr") return [`${value} bpm`, "FC"];
                if (name === "hrRaw") return [`${value} bpm`, "FC brute"];
                if (name === "hrCorr") return [`${value} bpm`, "FC corrigée"];
                if (name === "pace") return [fmtPace(value), "Allure"];
                if (name === "powerWithoutZeros") return [`${Math.round(value)} W`, "P"];
                if (name === "powerWithZeros") return [`${Math.round(value)} W`, "P0"];
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
            {isBike ? (
              <>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="powerWithoutZeros"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ r: 5, fill: "#2563EB", strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="powerWithZeros"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </>
            ) : (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pace"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 5, fill: "#2563EB", strokeWidth: 0 }}
                activeDot={{ r: 7 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
