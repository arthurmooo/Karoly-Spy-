import { useMemo, useState, type ReactNode } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { StreamPoint, GarminLap } from "@/types/activity";

interface Props {
  streams: StreamPoint[];
  laps?: GarminLap[] | null;
  sportType: string;
  /** Render prop: receives toggle buttons to place in parent layout */
  renderHeader?: (toggles: ReactNode) => ReactNode;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function speedToPaceNum(ms: number): number | null {
  if (!ms || ms <= 0) return null;
  return 1000 / ms / 60; // min/km
}

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}'${sec.toString().padStart(2, "0")} /km`;
}

/** Moving average (centered window). Does NOT smooth nulls into values. */
function smooth(values: (number | null)[], window = 3): (number | null)[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - half), i + half + 1)
      .filter((v): v is number => v != null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

type CurveKey = "hr" | "pace" | "power" | "alt";

export function ActivityStreamChart({ streams, laps, sportType, renderHeader }: Props) {
  const isBike = BIKE_SPORTS.has(sportType);

  const [visibleCurves, setVisibleCurves] = useState<Set<CurveKey>>(
    () => new Set<CurveKey>(isBike ? ["hr", "power", "alt"] : ["hr", "pace", "alt"]),
  );

  const toggleCurve = (key: CurveKey) => {
    setVisibleCurves((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chartData = useMemo(() => {
    const rawHr = streams.map((pt) => pt.hr ?? null);
    const rawPace = streams.map((pt) => (!isBike && pt.spd ? speedToPaceNum(pt.spd) : null));
    const rawPower = streams.map((pt) => (isBike && pt.pwr ? pt.pwr : null));
    const rawAlt = streams.map((pt) => pt.alt ?? null);

    const sHr = smooth(rawHr, 3);
    const sPace = smooth(rawPace, 3);
    const sPower = smooth(rawPower, 3);

    return streams.map((pt, i) => ({
      t: pt.t,
      hr: sHr[i],
      pace: sPace[i],
      power: sPower[i],
      alt: rawAlt[i],
      speed: isBike && pt.spd ? Math.round(pt.spd * 3.6 * 10) / 10 : null,
    }));
  }, [streams, isBike]);

  // Compute Y domains
  const hrValues = chartData.map((d) => d.hr).filter((v): v is number => v != null);
  const hrMin = hrValues.length ? Math.floor(Math.min(...hrValues) / 10) * 10 - 10 : 60;
  const hrMax = hrValues.length ? Math.ceil(Math.max(...hrValues) / 10) * 10 + 10 : 200;

  const secondaryValues = isBike
    ? chartData.map((d) => d.power).filter((v): v is number => v != null)
    : chartData.map((d) => d.pace).filter((v): v is number => v != null);

  const secMin = secondaryValues.length ? Math.floor(Math.min(...secondaryValues)) : 0;
  const secMax = secondaryValues.length ? Math.ceil(Math.max(...secondaryValues)) : 10;

  const altValues = chartData.map((d) => d.alt).filter((v): v is number => v != null);
  const altMin = altValues.length ? Math.min(...altValues) - 5 : 0;
  const altMax = altValues.length ? Math.max(...altValues) + 5 : 100;
  const hasAlt = altValues.length > 0;

  const lapLines = useMemo(() => {
    if (!laps?.length) return [];
    return laps.filter((l) => l.start_sec > 0).map((l) => l.start_sec);
  }, [laps]);

  const maxT = chartData.length > 0 ? (chartData[chartData.length - 1]?.t ?? 0) : 0;
  const tickInterval = Math.max(300, Math.ceil(maxT / 10 / 60) * 60);

  const secondaryKey: CurveKey = isBike ? "power" : "pace";
  const showHr = visibleCurves.has("hr");
  const showSecondary = visibleCurves.has(secondaryKey);
  const showAlt = hasAlt && visibleCurves.has("alt");

  const toggleButtons: { key: CurveKey; label: string; color: string }[] = [
    { key: "hr", label: "FC", color: "#ef4444" },
    ...(isBike
      ? [{ key: "power" as CurveKey, label: "Puissance", color: "#22c55e" }]
      : [{ key: "pace" as CurveKey, label: "Allure", color: "#3b82f6" }]),
    ...(hasAlt ? [{ key: "alt" as CurveKey, label: "Relief", color: "#94a3b8" }] : []),
  ];

  const togglesNode = (
    <div className="flex items-center gap-1.5">
      {toggleButtons.map(({ key, label, color }) => {
        const active = visibleCurves.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggleCurve(key)}
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
            style={
              active
                ? { backgroundColor: color, color: "#fff" }
                : { border: `1.5px solid ${color}`, color, background: "transparent" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full">
      {renderHeader ? renderHeader(togglesNode) : togglesNode}

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} className="dark:opacity-20" />

            <XAxis
              dataKey="t"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTime}
              interval={Math.max(1, Math.floor(tickInterval / 5))}
            />

            {/* Left Y axis: Heart Rate — always present for stable layout */}
            <YAxis
              yAxisId="left"
              domain={[hrMin, hrMax]}
              tick={showHr ? { fontSize: 11, fill: "#ef4444" } : false}
              tickLine={false}
              axisLine={false}
              width={showHr ? undefined : 0}
              label={
                showHr
                  ? { value: "bpm", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#ef4444" } }
                  : undefined
              }
            />

            {/* Right Y axis: Pace or Power — always present for stable layout */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={isBike ? [secMin - 20, secMax + 20] : [secMax + 0.5, Math.max(secMin - 0.5, 0)]}
              tick={showSecondary ? { fontSize: 11, fill: isBike ? "#22c55e" : "#3b82f6" } : false}
              tickLine={false}
              axisLine={false}
              width={showSecondary ? undefined : 0}
              tickFormatter={(v: number) => (isBike ? `${v}W` : formatPace(v))}
              label={
                showSecondary
                  ? {
                      value: isBike ? "Watts" : "min/km",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10, fill: isBike ? "#22c55e" : "#3b82f6" },
                    }
                  : undefined
              }
            />

            {/* Hidden Y axis for altitude */}
            <YAxis yAxisId="alt" domain={[altMin, altMax]} hide />

            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "hr") return [`${Math.round(value)} bpm`, "FC"];
                if (name === "pace") return [formatPace(value), "Allure"];
                if (name === "power") return [`${Math.round(value)} W`, "Puissance"];
                if (name === "speed") return [`${value} km/h`, "Vitesse"];
                if (name === "alt") return [`${Math.round(value)} m`, "Altitude"];
                return [value, name];
              }}
              labelFormatter={(t: number) => formatTime(t)}
            />

            {/* Lap transitions */}
            {lapLines.map((sec, i) => (
              <ReferenceLine
                key={`lap-${i}`}
                yAxisId="left"
                x={sec}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ))}

            {/* Altitude relief — behind other curves */}
            {showAlt && (
              <Area
                yAxisId="alt"
                type="monotone"
                dataKey="alt"
                stroke="none"
                fill="#94a3b8"
                fillOpacity={0.12}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* HR — Line only, no fill */}
            {showHr && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="hr"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* Pace (run) or Power (bike) */}
            {showSecondary &&
              (isBike ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="power"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pace"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
