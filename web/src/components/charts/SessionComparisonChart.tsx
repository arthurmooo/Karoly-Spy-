import { useMemo, useState, useCallback } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDistance } from "@/services/format.service";
import {
  formatComparisonTooltipMetric,
  type SessionComparisonChartModel,
} from "@/services/sessionComparison.service";
import { useChartTheme } from "@/hooks/useChartTheme";

interface Props {
  chartModel: SessionComparisonChartModel;
  height?: string;
  currentLabel?: string;
  referenceLabel?: string;
}

type CurveKey = "currentMetric" | "referenceMetric" | "currentHr" | "referenceHr" | "alt";

const MIN_ZOOM_PERCENT = 3;

function formatTooltipDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return formatDistance(distanceM);
}

export function SessionComparisonChart({
  chartModel,
  height,
  currentLabel = "Courante",
  referenceLabel = "Référence",
}: Props) {
  const ct = useChartTheme();

  // --- Toggle state ---
  const [visibleCurves, setVisibleCurves] = useState<Set<CurveKey>>(
    () => new Set<CurveKey>(["currentMetric", "referenceMetric", "currentHr", "referenceHr", "alt"]),
  );

  const toggleCurve = (key: CurveKey) => {
    setVisibleCurves((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // --- Drag-to-zoom state ---
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomWindow, setZoomWindow] = useState<{ start: number; end: number } | null>(null);

  const handleMouseDown = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload?.percent !== undefined) {
      setRefAreaLeft(e.activePayload[0].payload.percent as number);
      setRefAreaRight(null);
      setIsSelecting(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: any) => {
      if (isSelecting && e?.activePayload?.[0]?.payload?.percent !== undefined) {
        setRefAreaRight(e.activePayload[0].payload.percent as number);
      }
    },
    [isSelecting],
  );

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft !== null && refAreaRight !== null) {
      const start = Math.min(refAreaLeft, refAreaRight);
      const end = Math.max(refAreaLeft, refAreaRight);
      if (end - start >= MIN_ZOOM_PERCENT) {
        setZoomWindow({ start, end });
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  }, [refAreaLeft, refAreaRight]);

  // --- Filtered data when zoomed ---
  const displayData = useMemo(() => {
    if (!zoomWindow) return chartModel.data;
    return chartModel.data.filter((d) => d.percent >= zoomWindow.start && d.percent <= zoomWindow.end);
  }, [chartModel.data, zoomWindow]);

  // --- Altitude check ---
  const altValues = displayData
    .flatMap((point) => [point.currentAlt, point.referenceAlt])
    .filter((value): value is number => value != null);
  const hasAltitude = altValues.length > 0;

  // --- Compute Y domains on displayData (recalculated on zoom) ---
  const metricValues = displayData
    .flatMap((point) => [point.currentMetric, point.referenceMetric])
    .filter((value): value is number => value != null);
  const hrValues = displayData
    .flatMap((point) => [point.currentHr, point.referenceHr])
    .filter((value): value is number => value != null);

  const metricDomain =
    metricValues.length > 0
      ? [
          Math.min(...metricValues) - (chartModel.reversed ? 0.15 : 5),
          Math.max(...metricValues) + (chartModel.reversed ? 0.15 : 5),
        ]
      : ["auto", "auto"];
  const hrDomain =
    hrValues.length > 0
      ? [Math.min(...hrValues) - 10, Math.max(...hrValues) + 10]
      : ["auto", "auto"];
  const altDomain =
    altValues.length > 0
      ? [Math.min(...altValues) - 5, Math.max(...altValues) + 5]
      : ["auto", "auto"];

  // --- X domain ---
  const xDomain: [number, number] = zoomWindow
    ? [zoomWindow.start, zoomWindow.end]
    : [0, 100];

  // --- Zoom stats ---
  const zoomStats = useMemo(() => {
    if (!zoomWindow || displayData.length === 0) return null;

    const currentMetrics = displayData.map((d) => d.currentMetric).filter((v): v is number => v != null);
    const referenceMetrics = displayData.map((d) => d.referenceMetric).filter((v): v is number => v != null);
    const currentHrs = displayData.map((d) => d.currentHr).filter((v): v is number => v != null);
    const referenceHrs = displayData.map((d) => d.referenceHr).filter((v): v is number => v != null);

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    return {
      avgCurrentMetric: avg(currentMetrics),
      avgReferenceMetric: avg(referenceMetrics),
      avgCurrentHr: avg(currentHrs),
      avgReferenceHr: avg(referenceHrs),
    };
  }, [zoomWindow, displayData]);

  // --- Toggle button definitions ---
  const metricLabel = chartModel.metricKind === "power" ? "Puissance" : "Allure";
  const toggleButtons: { key: CurveKey; label: string; color: string; group: "current" | "reference" | "shared" }[] = [
    { key: "currentMetric", label: `${metricLabel} ${currentLabel}`, color: "#2563eb", group: "current" },
    { key: "currentHr", label: `FC ${currentLabel}`, color: "#ef4444", group: "current" },
    { key: "referenceMetric", label: `${metricLabel} ${referenceLabel}`, color: "#F97316", group: "reference" },
    { key: "referenceHr", label: `FC ${referenceLabel}`, color: "#64748b", group: "reference" },
    ...(hasAltitude ? [{ key: "alt" as CurveKey, label: "Relief", color: "#94a3b8", group: "shared" as const }] : []),
  ];

  const currentButtons = toggleButtons.filter((b) => b.group === "current");
  const referenceButtons = toggleButtons.filter((b) => b.group === "reference");
  const sharedButtons = toggleButtons.filter((b) => b.group === "shared");

  const renderToggle = ({ key, label, color }: { key: CurveKey; label: string; color: string }) => {
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
  };

  return (
    <div className="w-full space-y-2">
      {/* Toggle buttons bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {currentButtons.map(renderToggle)}
        <span className="text-slate-300 dark:text-slate-600 select-none">&middot;</span>
        {referenceButtons.map(renderToggle)}
        {sharedButtons.length > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-600 select-none">&middot;</span>
            {sharedButtons.map(renderToggle)}
          </>
        )}
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

      {/* Zoom stats banner */}
      {zoomWindow && zoomStats && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-[11px] text-slate-600 dark:text-slate-300 border border-blue-200 dark:border-blue-800/50">
          <span className="font-medium text-blue-700 dark:text-blue-400">
            Zoom : {Math.round(zoomWindow.start)}% → {Math.round(zoomWindow.end)}%
          </span>
          {visibleCurves.has("currentMetric") && zoomStats.avgCurrentMetric != null && (
            <span>
              {metricLabel} moy {currentLabel} :{" "}
              <span className="font-medium text-blue-600">{formatComparisonTooltipMetric(zoomStats.avgCurrentMetric, chartModel.metricKind)}</span>
            </span>
          )}
          {visibleCurves.has("referenceMetric") && zoomStats.avgReferenceMetric != null && (
            <span>
              {metricLabel} moy {referenceLabel} :{" "}
              <span className="font-medium text-orange-500">{formatComparisonTooltipMetric(zoomStats.avgReferenceMetric, chartModel.metricKind)}</span>
            </span>
          )}
          {visibleCurves.has("currentHr") && zoomStats.avgCurrentHr != null && (
            <span>
              FC moy {currentLabel} : <span className="font-medium text-red-500">{Math.round(zoomStats.avgCurrentHr)} bpm</span>
            </span>
          )}
          {visibleCurves.has("referenceHr") && zoomStats.avgReferenceHr != null && (
            <span>
              FC moy {referenceLabel} : <span className="font-medium text-slate-500">{Math.round(zoomStats.avgReferenceHr)} bpm</span>
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className={`${height ?? "h-[360px]"} w-full select-none`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayData}
            margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              dataKey="percent"
              domain={xDomain}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${Math.round(value)}%`}
              allowDataOverflow
            />
            <YAxis
              yAxisId="metric"
              orientation="right"
              domain={metricDomain}
              reversed={chartModel.reversed}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="hr"
              domain={hrDomain}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="alt" domain={altDomain} hide />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof chartModel.data)[number];
                return (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {`${currentLabel}: ${formatTooltipDistance(point.currentDistanceM)} | ${referenceLabel}: ${formatTooltipDistance(point.referenceDistanceM)}`}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Repère de superposition: {Math.round(label as number)}%
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {visibleCurves.has("currentMetric") && (
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
                          <span className="text-slate-500 dark:text-slate-400">{metricLabel} {currentLabel}</span>
                          <span className="ml-auto font-mono text-slate-900 dark:text-white">
                            {formatComparisonTooltipMetric(point.currentMetric, chartModel.metricKind)}
                          </span>
                        </div>
                      )}
                      {visibleCurves.has("referenceMetric") && (
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />
                          <span className="text-slate-500 dark:text-slate-400">{metricLabel} {referenceLabel}</span>
                          <span className="ml-auto font-mono text-slate-900 dark:text-white">
                            {formatComparisonTooltipMetric(point.referenceMetric, chartModel.metricKind)}
                          </span>
                        </div>
                      )}
                      {visibleCurves.has("currentHr") && (
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                          <span className="text-slate-500 dark:text-slate-400">FC {currentLabel}</span>
                          <span className="ml-auto font-mono text-slate-900 dark:text-white">
                            {point.currentHr != null ? `${Math.round(point.currentHr)} bpm` : "--"}
                          </span>
                        </div>
                      )}
                      {visibleCurves.has("referenceHr") && (
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#64748b]" />
                          <span className="text-slate-500 dark:text-slate-400">FC {referenceLabel}</span>
                          <span className="ml-auto font-mono text-slate-900 dark:text-white">
                            {point.referenceHr != null ? `${Math.round(point.referenceHr)} bpm` : "--"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* Altitude areas */}
            {hasAltitude && visibleCurves.has("alt") && (
              <>
                <Area
                  yAxisId="alt"
                  type="monotone"
                  dataKey="referenceAlt"
                  stroke="none"
                  fill="#cbd5e1"
                  fillOpacity={0.18}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="alt"
                  type="monotone"
                  dataKey="currentAlt"
                  stroke="none"
                  fill="#bfdbfe"
                  fillOpacity={0.14}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </>
            )}

            {/* Metric lines */}
            {visibleCurves.has("currentMetric") && (
              <Line
                yAxisId="metric"
                type="monotone"
                dataKey="currentMetric"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {visibleCurves.has("referenceMetric") && (
              <Line
                yAxisId="metric"
                type="monotone"
                dataKey="referenceMetric"
                stroke="#F97316"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* HR lines */}
            {visibleCurves.has("currentHr") && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="currentHr"
                stroke="#ef4444"
                strokeWidth={1.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {visibleCurves.has("referenceHr") && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="referenceHr"
                stroke="#64748b"
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* Drag selection overlay */}
            {isSelecting && refAreaLeft !== null && refAreaRight !== null && (
              <ReferenceArea
                yAxisId="metric"
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
