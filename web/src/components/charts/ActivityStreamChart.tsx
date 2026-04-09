import { useMemo, useState, useCallback, type ReactNode } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import type { StreamPoint, GarminLap } from "@/types/activity";
import type { DetectedSegment } from "@/services/manualIntervals.service";
import { speedToPaceDecimal, speedToSwimPaceDecimal, formatPaceDecimal, formatSwimPaceDecimal } from "@/services/format.service";
import { getStreamPowerForRange, isBikeSport, isSwimSport } from "@/services/activity.service";
import { useChartTheme } from "@/hooks/useChartTheme";

interface Props {
  streams: StreamPoint[];
  laps?: GarminLap[] | null;
  sportType: string;
  highlightedSegments?: DetectedSegment[];
  /** Time-range highlights for the active analysis view (intervals or windows). */
  analysisHighlights?: { startSec: number; endSec: number }[];
  /** Render prop: receives toggle buttons to place in parent layout */
  renderHeader?: (toggles: ReactNode) => ReactNode;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function speedToPaceNum(ms: number, swim = false): number | null {
  if (!ms || ms < 1.0) return null;   // < 1.0 m/s (~16:40/km) is walk/noise
  return swim ? speedToSwimPaceDecimal(ms) : speedToPaceDecimal(ms);
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

/** Map data range to occupy a specific vertical band of the chart (0=bottom, 1=top). */
function bandDomain(dataMin: number, dataMax: number, bandStart: number, bandEnd: number): [number, number] {
  const range = dataMax - dataMin || 1;
  const bandSize = bandEnd - bandStart;
  const totalRange = range / bandSize;
  return [dataMin - bandStart * totalRange, dataMax + (1 - bandEnd) * totalRange];
}

type CurveKey = "hr" | "pace" | "power" | "alt" | "laps";

const MIN_ZOOM_SECONDS = 10;

export function ActivityStreamChart({
  streams,
  laps,
  sportType,
  highlightedSegments = [],
  analysisHighlights = [],
  renderHeader,
}: Props) {
  const isBike = isBikeSport(sportType);
  const isSwim = isSwimSport(sportType);
  const ct = useChartTheme();
  const fmtPace = isSwim ? formatSwimPaceDecimal : formatPaceDecimal;

  const [visibleCurves, setVisibleCurves] = useState<Set<CurveKey>>(
    () => new Set<CurveKey>(isBike ? ["hr", "power", "alt"] : ["hr", "pace", "alt"]),
  );

  // Drag-to-zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomWindow, setZoomWindow] = useState<{ start: number; end: number } | null>(null);

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
    const rawPace = streams.map((pt) => (!isBike && pt.spd ? speedToPaceNum(pt.spd, isSwim) : null));
    const rawPower = streams.map((pt) => (isBike && typeof pt.pwr === "number" ? pt.pwr : null));
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
  }, [streams, isBike, isSwim]);

  // Filter data when zoomed
  const displayData = useMemo(() => {
    if (!zoomWindow) return chartData;
    return chartData.filter((d) => d.t >= zoomWindow.start && d.t <= zoomWindow.end);
  }, [chartData, zoomWindow]);

  // Compute Y domains on displayData (recalculated on zoom)
  const hrValues = displayData.map((d) => d.hr).filter((v): v is number => v != null);
  const hrMin = hrValues.length ? Math.floor(Math.min(...hrValues) / 10) * 10 - 10 : 60;
  const hrMax = hrValues.length ? Math.ceil(Math.max(...hrValues) / 10) * 10 + 10 : 200;

  const secondaryValues = isBike
    ? displayData.map((d) => d.power).filter((v): v is number => v != null)
    : displayData.map((d) => d.pace).filter((v): v is number => v != null);

  const secMin = secondaryValues.length ? Math.floor(Math.min(...secondaryValues)) : 0;
  const secMax = secondaryValues.length ? Math.ceil(Math.max(...secondaryValues)) : 10;

  const altValues = displayData.map((d) => d.alt).filter((v): v is number => v != null);
  const altMin = altValues.length ? Math.min(...altValues) - 5 : 0;
  const altMax = altValues.length ? Math.max(...altValues) + 5 : 100;
  const hasAlt = altValues.length > 0;

  const lapLines = useMemo(() => {
    if (!laps?.length) return [];
    return laps.filter((l) => l.start_sec > 0).map((l) => l.start_sec);
  }, [laps]);

  // X axis domain and ticks based on displayData
  const xMin = displayData.length > 0 ? (displayData[0]?.t ?? 0) : 0;
  const xMax = displayData.length > 0 ? (displayData[displayData.length - 1]?.t ?? 0) : 0;
  const xRange = xMax - xMin;
  const tickInterval = Math.max(60, Math.ceil(xRange / 10 / 60) * 60);
  const firstTick = Math.ceil(xMin / tickInterval) * tickInterval;
  const xTicks = Array.from(
    { length: Math.floor((xMax - firstTick) / tickInterval) + 1 },
    (_, i) => firstTick + i * tickInterval,
  );

  const secondaryKey: CurveKey = isBike ? "power" : "pace";
  const showHr = visibleCurves.has("hr");
  const showSecondary = visibleCurves.has(secondaryKey);
  const showAlt = hasAlt && visibleCurves.has("alt");

  // Strava-like band separation: each metric gets its own vertical band
  const activeCount = [showHr, showSecondary, showAlt].filter(Boolean).length;
  const useBands = activeCount >= 2;

  const hrDomain: [number, number] = useBands
    ? bandDomain(hrMin, hrMax, 0.55, 0.90)
    : [hrMin, hrMax];
  const secondaryDomain: [number, number] = useBands
    ? bandDomain(
        isBike ? secMin - 20 : Math.max(secMin - 0.5, 0),
        isBike ? secMax + 20 : secMax + 0.5,
        isBike ? 0.25 : 0.40,
        isBike ? 0.60 : 0.75,
      )
    : isBike ? [secMin - 20, secMax + 20] : [Math.max(secMin - 0.5, 0), secMax + 0.5];
  const altBandDomain: [number, number] = useBands
    ? bandDomain(altMin, altMax, 0.0, 0.25)
    : [altMin, altMax];

  // --- Mouse event handlers for drag-to-zoom ---
  const handleMouseDown = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload?.t !== undefined) {
      const t = e.activePayload[0].payload.t as number;
      setRefAreaLeft(t);
      setRefAreaRight(null);
      setIsSelecting(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (isSelecting && e?.activePayload?.[0]?.payload?.t !== undefined) {
        setRefAreaRight(e.activePayload[0].payload.t as number);
      }
    },
    [isSelecting],
  );

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft !== null && refAreaRight !== null) {
      const start = Math.min(refAreaLeft, refAreaRight);
      const end = Math.max(refAreaLeft, refAreaRight);
      if (end - start >= MIN_ZOOM_SECONDS) {
        setZoomWindow({ start, end });
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  }, [refAreaLeft, refAreaRight]);

  // --- Selection stats (when zoomed) ---
  const zoomStats = useMemo(() => {
    if (!zoomWindow || displayData.length === 0) return null;

    const duration = zoomWindow.end - zoomWindow.start;

    const hrs = displayData.map((d) => d.hr).filter((v): v is number => v != null);
    const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;

    if (isBike) {
      const avgPowerWithoutZeros = getStreamPowerForRange(streams, zoomWindow.start, zoomWindow.end, "t", false);
      const avgPowerWithZeros = getStreamPowerForRange(streams, zoomWindow.start, zoomWindow.end, "t", true);
      return { duration, avgHr, avgPowerWithoutZeros, avgPowerWithZeros, avgPace: null };
    }
    // Run/Swim: distance-weighted pace from speed stream
    const paceToMs = isSwim ? 100 : 1000; // reverse conversion factor
    const speeds = displayData
      .map((d) => (d.pace != null ? paceToMs / (d.pace * 60) : null)) // pace back to m/s
      .filter((v): v is number => v != null && v > 0);
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    const avgPace = avgSpeed ? speedToPaceNum(avgSpeed, isSwim) : null;
    return { duration, avgHr, avgPowerWithoutZeros: null, avgPowerWithZeros: null, avgPace };
  }, [zoomWindow, displayData, isBike, isSwim, streams]);

  const toggleButtons: { key: CurveKey; label: string; color: string }[] = [
    { key: "hr", label: "FC", color: "#ef4444" },
    ...(isBike
      ? [{ key: "power" as CurveKey, label: "Puissance", color: "#22c55e" }]
      : [{ key: "pace" as CurveKey, label: "Allure", color: "#3b82f6" }]),
    ...(hasAlt ? [{ key: "alt" as CurveKey, label: "Relief", color: "#94a3b8" }] : []),
    ...(lapLines.length > 0 ? [{ key: "laps" as CurveKey, label: "Tours", color: "#64748b" }] : []),
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
      {zoomWindow && (
        <button
          type="button"
          onClick={() => setZoomWindow(null)}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset Zoom
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {renderHeader ? renderHeader(togglesNode) : togglesNode}

      {/* Zoom stats banner */}
      {zoomWindow && zoomStats && (
        <div className="flex items-center gap-4 px-3 py-1.5 mt-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-[11px] text-slate-600 dark:text-slate-300 border border-blue-200 dark:border-blue-800/50">
          <span className="font-medium text-blue-700 dark:text-blue-400">
            Zoom : {formatTime(zoomStats.duration)}
          </span>
          {zoomStats.avgHr != null && (
            <span>FC moy : <span className="font-medium text-red-500">{zoomStats.avgHr} bpm</span></span>
          )}
          {zoomStats.avgPace != null && (
            <span>Allure moy : <span className="font-medium text-blue-500">{fmtPace(zoomStats.avgPace)}</span></span>
          )}
          {zoomStats.avgPowerWithoutZeros != null && (
            <span>P sans 0 : <span className="font-medium text-green-500">{Math.round(zoomStats.avgPowerWithoutZeros)} W</span></span>
          )}
          {zoomStats.avgPowerWithZeros != null && (
            <span>P avec 0 : <span className="font-medium text-emerald-600">{Math.round(zoomStats.avgPowerWithZeros)} W</span></span>
          )}
        </div>
      )}

      <div className="h-[400px] w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" vertical={false} />

            <XAxis
              type="number"
              dataKey="t"
              domain={[xMin, xMax]}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTime}
              ticks={xTicks}
              allowDuplicatedCategory={false}
            />

            {/* Left Y axis: Heart Rate — no ticks, tooltip provides values */}
            <YAxis yAxisId="left" domain={hrDomain} allowDataOverflow hide />

            {/* Right Y axis: Pace or Power — no ticks, tooltip provides values */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={secondaryDomain}
              reversed={!isBike}
              allowDataOverflow
              hide
            />

            {/* Hidden Y axis for altitude */}
            <YAxis yAxisId="alt" domain={altBandDomain} allowDataOverflow hide />

            <Tooltip
              contentStyle={ct.tooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === "hr") return [`${Math.round(value)} bpm`, "FC"];
                if (name === "pace") return [fmtPace(value), "Allure"];
                if (name === "power") return [`${Math.round(value)} W`, "Puissance instant."];
                if (name === "speed") return [`${value} km/h`, "Vitesse"];
                if (name === "alt") return [`${Math.round(value)} m`, "Altitude"];
                return [value, name];
              }}
              labelFormatter={(t: number) => formatTime(t)}
            />

            {/* Highlighted segments */}
            {highlightedSegments.map((segment) => (
              <ReferenceArea
                key={segment.id}
                x1={segment.startSec}
                x2={segment.endSec}
                yAxisId="left"
                strokeOpacity={0}
                fill={isBike ? "#22c55e" : "#f97316"}
                fillOpacity={0.12}
                ifOverflow="extendDomain"
              />
            ))}

            {analysisHighlights.map((bh, i) => (
              <ReferenceArea
                key={`block-hl-${i}`}
                x1={bh.startSec}
                x2={bh.endSec}
                yAxisId="left"
                strokeOpacity={0}
                fill="#2563EB"
                fillOpacity={0.10}
                ifOverflow="extendDomain"
              />
            ))}

            {visibleCurves.has("laps") && lapLines.map((sec, i) => (
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

            {/* Drag selection overlay */}
            {isSelecting && refAreaLeft !== null && refAreaRight !== null && (
              <ReferenceArea
                yAxisId="left"
                x1={Math.min(refAreaLeft, refAreaRight)}
                x2={Math.max(refAreaLeft, refAreaRight)}
                strokeOpacity={0.3}
                fill="#2563EB"
                fillOpacity={0.2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
