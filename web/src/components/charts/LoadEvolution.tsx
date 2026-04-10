import { useState, useRef, useMemo, useCallback } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { WeeklyLoadPoint } from "@/services/stats.service";

interface LoadEvolutionProps {
  points: WeeklyLoadPoint[];
}

const TOOLTIP_W = 180;

export function LoadEvolution({ points }: LoadEvolutionProps) {
  const [activePoint, setActivePoint] = useState<{ data: WeeklyLoadPoint; cx: number; cy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ct = useChartTheme();

  const handleMouseMove = useCallback((state: any) => {
    if (state.activePayload?.length) {
      const data = state.activePayload[0].payload as WeeklyLoadPoint;
      setActivePoint({
        data,
        cx: state.activeCoordinate?.x ?? 0,
        cy: state.activeCoordinate?.y ?? 0,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActivePoint(null);
  }, []);

  const chartElement = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <defs>
          <linearGradient id="loadEvolutionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.tick }} />
        <YAxis tick={{ fontSize: 11, fill: ct.tick }} />
        <Tooltip content={() => null} cursor={false} />
        <Area
          type="monotone"
          dataKey="load"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#loadEvolutionFill)"
          isAnimationActive={false}
          activeDot={{ r: 5, stroke: "#2563eb", strokeWidth: 2, fill: ct.activeDotFill }}
        />
      </AreaChart>
    </ResponsiveContainer>
  ), [points, handleMouseMove, handleMouseLeave, ct]);

  if (points.length === 0) {
    return (
      <FeatureNotice
        title="Évolution de la charge"
        description="Aucune charge MLS disponible sur les 8 dernières semaines."
        status="unavailable"
      />
    );
  }

  // Position tooltip near cursor: right of point, flip left if overflow
  let tooltipX = 0;
  let tooltipY = 0;
  if (activePoint) {
    const containerW = containerRef.current?.offsetWidth ?? 600;
    const GAP = 16;
    tooltipX = activePoint.cx + GAP;
    if (tooltipX + TOOLTIP_W > containerW) {
      tooltipX = activePoint.cx - TOOLTIP_W - GAP;
    }
    tooltipX = Math.max(0, tooltipX);
    tooltipY = Math.max(8, activePoint.cy - 20);
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Évolution de la charge
        </CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">Somme MLS par semaine calendaire sur les 8 dernières semaines.</p>
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        <div ref={containerRef} className="relative h-[320px]">
          {chartElement}

          {activePoint && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-800 dark:bg-slate-900"
              style={{ left: tooltipX, top: tooltipY, transition: "left 100ms ease-out, top 100ms ease-out" }}
            >
              <p className="font-medium text-slate-900 dark:text-white">Sem. du {activePoint.data.label}</p>
              <p className="text-slate-600 dark:text-slate-300">
                {activePoint.data.load.toFixed(1).replace(".", ",")} MLS
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
