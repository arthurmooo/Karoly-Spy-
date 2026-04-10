import { useMemo, useState, useRef, useCallback } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { getSportConfig } from "@/lib/constants";
import type { SportDistributionItem } from "@/services/stats.service";

interface VolumeDistributionProps {
  items: SportDistributionItem[];
}

interface ChartRow {
  name: string;
  value: number;
  fill: string;
  hours: number;
  distanceKm: number;
  avgRpe: number | null;
}

const TOOLTIP_W = 200;
const TOOLTIP_H = 40;

export function VolumeDistribution({ items }: VolumeDistributionProps) {
  const [activeBar, setActiveBar] = useState<{ row: ChartRow; cx: number; cy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((state: any) => {
    if (state.activePayload?.length) {
      const row = state.activePayload[0].payload as ChartRow;
      setActiveBar({
        row,
        cx: state.activeCoordinate?.x ?? 0,
        cy: state.activeCoordinate?.y ?? 0,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveBar(null);
  }, []);

  const chartData = useMemo<ChartRow[]>(
    () =>
      items.map((item) => {
        const config = getSportConfig(item.sportKey);
        return {
          name: item.label,
          value: item.percent,
          fill: config.hexColor,
          hours: item.hours,
          distanceKm: item.distanceKm,
          avgRpe: item.avgRpe,
        };
      }),
    [items]
  );

  const chartElement = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 12, bottom: 0 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickFormatter={(value: number) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#64748b" }}
          width={70}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {chartData.map((item) => (
            <Cell key={item.name} fill={item.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  ), [chartData, handleMouseMove, handleMouseLeave]);

  if (items.length === 0) {
    return (
      <FeatureNotice
        title="Répartition du volume"
        description="Aucune séance exploitable sur la période sélectionnée."
        status="unavailable"
      />
    );
  }

  // Position tooltip near cursor: right of cx, flipped left if overflow; vertically centered on bar
  let tooltipX = 0;
  let tooltipY = 0;
  if (activeBar) {
    const containerW = containerRef.current?.offsetWidth ?? 600;
    const containerH = containerRef.current?.offsetHeight ?? 220;
    const GAP = 16;
    tooltipX = activeBar.cx + GAP;
    if (tooltipX + TOOLTIP_W > containerW) {
      tooltipX = activeBar.cx - TOOLTIP_W - GAP;
    }
    tooltipX = Math.max(0, tooltipX);
    tooltipY = activeBar.cy - TOOLTIP_H / 2;
    tooltipY = Math.max(0, Math.min(tooltipY, containerH - TOOLTIP_H));
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Répartition du volume
        </CardTitle>
        <p className="text-sm text-slate-500">Volume calculé sur le temps d'entraînement cumulé.</p>
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        <div ref={containerRef} className="relative h-[220px]">
          {chartElement}

          {activeBar && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-md dark:border-slate-800 dark:bg-slate-900"
              style={{ left: tooltipX, top: tooltipY, transition: "left 100ms ease-out, top 100ms ease-out" }}
            >
              <p className="mb-1 font-medium text-slate-900 dark:text-white">{activeBar.row.name}</p>
              <p className="text-slate-600 dark:text-slate-300">
                {activeBar.row.value.toFixed(1).replace(".", ",")} %
                {" · "}
                {activeBar.row.hours.toFixed(1).replace(".", ",")} h
                {activeBar.row.distanceKm > 0
                  ? ` · ${activeBar.row.distanceKm.toFixed(0)} km`
                  : ""}
              </p>
              {activeBar.row.avgRpe != null && (
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  RPE moyen : {activeBar.row.avgRpe.toFixed(1).replace(".", ",")}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
