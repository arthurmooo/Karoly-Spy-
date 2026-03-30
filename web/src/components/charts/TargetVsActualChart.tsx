import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell } from "recharts";
import type { BlockGroupedIntervals, PlannedIntervalBlock } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { formatPaceDecimal, speedToPaceDecimal } from "@/services/format.service";

interface Props {
  intervalsByBlock: BlockGroupedIntervals[];
  plannedBlocks: PlannedIntervalBlock[] | undefined;
  sportType: string;
  hideTitle?: boolean;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

type ChartRow = {
  index: number;
  actual: number | null;
  actualLabel: string | null;
  plannedLine: number | null;
  plannedLineLabel: string | null;
  plannedMin: number | null;
  plannedMax: number | null;
  plannedRangeLabel: string | null;
  /** true when actual is inside [plannedMin, plannedMax] or matches plannedLine */
  inTarget: boolean;
};

type PreparedChartModel = {
  chartData: ChartRow[];
  yMax: number;
  domainMin: number;
  hasPlannedTargets: boolean;
};

function toRunPaceFromSpeed(speed: number | null | undefined): number | null {
  if (speed == null || speed <= 0) return null;
  return speedToPaceDecimal(speed);
}

function formatTargetRange(min: number | null, max: number | null, isBike: boolean): string | null {
  if (min == null && max == null) return null;
  if (isBike) {
    if (min != null && max != null) return `${Math.round(min)}-${Math.round(max)} W`;
    const value = min ?? max;
    return value != null ? `${Math.round(value)} W` : null;
  }

  if (min != null && max != null) {
    const slower = Math.max(min, max);
    const faster = Math.min(min, max);
    return `${formatPaceDecimal(slower)} - ${formatPaceDecimal(faster)}`;
  }
  const value = min ?? max;
  return value != null ? formatPaceDecimal(value) : null;
}

function buildTargetVsActualChartModel(
  intervalsByBlock: BlockGroupedIntervals[],
  plannedBlocks: PlannedIntervalBlock[] | undefined,
  isBike: boolean
): PreparedChartModel {
  if (!plannedBlocks?.length || intervalsByBlock.length === 0) {
    return { chartData: [], yMax: 0, domainMin: 0, hasPlannedTargets: false };
  }

  const rows: ChartRow[] = [];
  let hasPlannedTargets = false;

  for (const group of intervalsByBlock) {
    const activeIntervals = group.intervals.filter((i) => i.type === "work" || i.type === "active");
    const matchingPlanned = plannedBlocks.find((b) => b.block_index === group.blockIndex);

    let plannedMin = isBike
      ? matchingPlanned?.target_type === "power" ? matchingPlanned.target_min : null
      : toRunPaceFromSpeed(matchingPlanned?.target_max ?? null);
    let plannedMax = isBike
      ? matchingPlanned?.target_type === "power" ? matchingPlanned.target_max : null
      : toRunPaceFromSpeed(matchingPlanned?.target_min ?? null);

    if (!isBike && plannedMin != null && plannedMax != null && plannedMin > plannedMax) {
      const tmp = plannedMin;
      plannedMin = plannedMax;
      plannedMax = tmp;
    }

    const plannedLine = plannedMin != null && plannedMax != null
      ? null
      : (plannedMin ?? plannedMax ?? null);

    if (plannedMin != null || plannedMax != null || plannedLine != null) {
      hasPlannedTargets = true;
    }

    for (const intv of activeIntervals) {
      const actual = isBike
        ? intv.avg_power
        : intv.avg_speed && intv.avg_speed > 0
          ? speedToPaceDecimal(intv.avg_speed)
          : null;

      // Determine if actual is within target range
      let inTarget = false;
      if (actual != null) {
        if (plannedMin != null && plannedMax != null) {
          const lo = Math.min(plannedMin, plannedMax);
          const hi = Math.max(plannedMin, plannedMax);
          inTarget = actual >= lo && actual <= hi;
        } else if (plannedLine != null) {
          const tolerance = isBike ? 5 : 0.05; // 5W or 3sec/km
          inTarget = Math.abs(actual - plannedLine) <= tolerance;
        }
      }

      rows.push({
        index: rows.length + 1,
        actual: actual ?? null,
        actualLabel: isBike
          ? (actual != null ? `${Math.round(actual)} W` : null)
          : (actual != null ? formatPaceDecimal(actual) : null),
        plannedLine,
        plannedLineLabel: plannedLine != null ? formatTargetRange(plannedLine, null, isBike) : null,
        plannedMin,
        plannedMax,
        plannedRangeLabel: formatTargetRange(plannedMin, plannedMax, isBike),
        inTarget,
      });
    }
  }

  if (!hasPlannedTargets || rows.length === 0) {
    return { chartData: [], yMax: 0, domainMin: 0, hasPlannedTargets: false };
  }

  const allValues = rows.flatMap((row) => [row.actual, row.plannedLine, row.plannedMin, row.plannedMax].filter((v): v is number => v != null));
  if (allValues.length === 0) {
    return { chartData: [], yMax: 0, domainMin: 0, hasPlannedTargets: false };
  }

  if (isBike) {
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    const range = maxVal - minVal || maxVal * 0.1;
    const padding = Math.max(range * 0.35, 10);
    return {
      chartData: rows,
      yMax: Math.ceil(maxVal + padding),
      domainMin: Math.floor(Math.max(0, minVal - padding)),
      hasPlannedTargets: true,
    };
  }

  const maxVal = Math.ceil(Math.max(...allValues) + 0.3);
  const minVal = Math.floor(Math.min(...allValues) - 0.3);

  return {
    chartData: rows.map((row) => {
      const pMin = row.plannedMin != null ? maxVal - row.plannedMin : null;
      const pMax = row.plannedMax != null ? maxVal - row.plannedMax : null;
      return {
        ...row,
        actual: row.actual != null ? maxVal - row.actual : null,
        plannedLine: row.plannedLine != null ? maxVal - row.plannedLine : null,
        // For the range bar we need [lower, upper] in inverted space
        plannedMin: pMin != null && pMax != null ? Math.min(pMin, pMax) : (pMin ?? pMax),
        plannedMax: pMin != null && pMax != null ? Math.max(pMin, pMax) : null,
      };
    }),
    yMax: maxVal,
    domainMin: minVal,
    hasPlannedTargets: true,
  };
}

export function TargetVsActualChart({ intervalsByBlock, plannedBlocks, sportType, hideTitle }: Props) {
  const isBike = BIKE_SPORTS.has(sportType);

  const { chartData, yMax, domainMin, hasPlannedTargets } = useMemo(
    () => buildTargetVsActualChartModel(intervalsByBlock, plannedBlocks, isBike),
    [intervalsByBlock, plannedBlocks, isBike]
  );

  if (!hasPlannedTargets || chartData.length === 0) {
    return (
      <FeatureNotice
        title="Prévu vs Réalisé"
        description="Objectif planifié indisponible pour cette séance."
        status="unavailable"
      />
    );
  }

  // Build data with range bar base/height for the planned zone
  const barData = useMemo(
    () =>
      chartData.map((row) => {
        const hasRange = row.plannedMin != null && row.plannedMax != null;
        return {
          ...row,
          // For the "range" bar: base offset + height
          rangeBase: hasRange ? row.plannedMin! : 0,
          rangeHeight: hasRange ? row.plannedMax! - row.plannedMin! : 0,
        };
      }),
    [chartData]
  );

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Prévu vs Réalisé
        </h3>
      )}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="20%">
            <XAxis
              type="number"
              dataKey="index"
              domain={[0.5, barData.length + 0.5]}
              allowDecimals={false}
              ticks={barData.map((d) => d.index)}
              tickFormatter={(v: number) => `R${v}`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              domain={isBike ? [domainMin, yMax] : [0, yMax - domainMin]}
              tickFormatter={
                isBike
                  ? (v: number) => `${Math.round(v)}W`
                  : (v: number) => formatPaceDecimal(yMax - v)
              }
            />

            {/* Planned target zone rendered as ReferenceArea (coordinate-based, no bar alignment issues) */}
            {barData.map((row, i) =>
              row.rangeHeight > 0 ? (
                <ReferenceArea
                  key={`range-${i}`}
                  x1={row.index - 0.15}
                  x2={row.index + 0.15}
                  y1={row.rangeBase}
                  y2={row.rangeBase + row.rangeHeight}
                  fill="#F9731633"
                  stroke="#F97316"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
              ) : null
            )}

            {/* Single-value planned line (when no range) */}
            {barData.map((row) =>
              row.plannedLine != null ? (
                <ReferenceLine
                  key={`planned-line-${row.index}`}
                  segment={[
                    { x: row.index - 0.45, y: row.plannedLine },
                    { x: row.index + 0.45, y: row.plannedLine },
                  ]}
                  stroke="#F97316"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                />
              ) : null
            )}

            {/* Actual performance bars */}
            <Bar dataKey="actual" name="actual" isAnimationActive={false} radius={[4, 4, 0, 0]} barSize={24}>
              {barData.map((row, i) => (
                <Cell
                  key={`actual-${i}`}
                  fill={row.inTarget ? "#2563EB" : "#2563EB"}
                  fillOpacity={row.inTarget ? 1 : 0.8}
                />
              ))}
            </Bar>

            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                borderRadius: 16,
                border: 'none',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                fontSize: "12px",
                backgroundColor: "white",
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as ChartRow & { rangeBase: number; rangeHeight: number };
                if (!row) return null;

                const actualRaw = row.actual;
                const actualLabel = actualRaw != null
                  ? isBike
                    ? `${Math.round(actualRaw)} W`
                    : formatPaceDecimal(yMax - actualRaw)
                  : "—";

                const targetLabel = row.plannedRangeLabel ?? row.plannedLineLabel;

                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Intervalle {label}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-lg" style={{ backgroundColor: "#2563EB" }} />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Réalisé : {actualLabel}</span>
                    </div>
                    {targetLabel && (
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-lg border-2 border-dashed" style={{ borderColor: "#F97316", backgroundColor: "#F9731620" }} />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Cible : {targetLabel}</span>
                      </div>
                    )}
                    {row.plannedRangeLabel && actualRaw != null && (
                      <p className={`mt-1 text-xs font-medium ${row.inTarget ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {row.inTarget ? "Dans la cible" : "Hors cible"}
                      </p>
                    )}
                  </div>
                );
              }}
              labelFormatter={(l) => `Intervalle ${l}`}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-lg" style={{ backgroundColor: "#2563EB" }} />
          Réalisé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-lg border-2 border-dashed" style={{ borderColor: "#F97316", backgroundColor: "#F9731620" }} />
          Cible (prévu)
        </span>
      </div>
    </div>
  );
}

export { buildTargetVsActualChartModel };
