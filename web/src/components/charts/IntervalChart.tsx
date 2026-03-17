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
import type { ActivityInterval } from "@/types/activity";
import type { PhysioProfile } from "@/types/physio";
import { formatPaceDecimal } from "@/services/format.service";

interface Props {
  intervals: ActivityInterval[];
  physioProfile: PhysioProfile | null;
  sportType: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

export function IntervalChart({ intervals, physioProfile, sportType, hideTitle }: Props & { hideTitle?: boolean }) {
  const isBike = BIKE_SPORTS.has(sportType);

  const activeIntervals = useMemo(
    () => intervals.filter((i) => i.type === "work" || i.type === "active"),
    [intervals]
  );

  const data = useMemo(
    () =>
      activeIntervals.map((intv, i) => ({
        index: i + 1,
        hr: intv.avg_hr != null ? Math.round(intv.avg_hr) : null,
        pace: !isBike && intv.avg_speed && intv.avg_speed > 0
          ? Math.round((1000 / intv.avg_speed / 60) * 100) / 100
          : null,
        power: isBike && intv.avg_power ? Math.round(intv.avg_power) : null,
      })),
    [activeIntervals, isBike]
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
          Évolution par intervalle
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
              label={{ value: "N° intervalle", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
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
                if (name === "pace") return [formatPaceDecimal(value), "Allure"];
                if (name === "power") return [`${value} W`, "Puissance"];
                return [value, name];
              }}
              labelFormatter={(l) => `Intervalle ${l}`}
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
