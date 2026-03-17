import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ActivityInterval, IntervalBlock } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { formatPaceDecimal } from "@/services/format.service";

interface Props {
  intervals: ActivityInterval[];
  blocks: IntervalBlock[] | undefined;
  sportType: string;
}

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);

export function TargetVsActualChart({ intervals, blocks, sportType, hideTitle }: Props & { hideTitle?: boolean }) {
  const isBike = BIKE_SPORTS.has(sportType);

  const data = useMemo(() => {
    if (!blocks?.length) return [];

    const activeIntervals = intervals.filter((i) => i.type === "work" || i.type === "active");
    if (activeIntervals.length === 0) return [];

    // Build per-interval comparison using block mean as "planned"
    let cursor = 0;
    const rows: { index: number; planned: number | null; actual: number | null }[] = [];

    for (const block of blocks) {
      const count = block.count ?? 0;
      const planned = isBike ? block.interval_power_mean : block.interval_pace_mean;
      const blockIntervals = activeIntervals.slice(cursor, cursor + count);
      cursor += count;

      for (let i = 0; i < blockIntervals.length; i++) {
        const intv = blockIntervals[i]!;
        const actual = isBike
          ? intv.avg_power
          : intv.avg_speed && intv.avg_speed > 0
            ? 1000 / intv.avg_speed / 60
            : null;

        rows.push({
          index: rows.length + 1,
          planned: planned ?? null,
          actual: actual ?? null,
        });
      }
    }

    return rows;
  }, [intervals, blocks, isBike]);

  if (data.length === 0 || !blocks?.some((b) => (isBike ? b.interval_power_mean : b.interval_pace_mean) != null)) {
    return (
      <FeatureNotice
        title="Prévu vs Réalisé"
        description="Objectif non disponible — pas de données planifiées pour cette séance."
        status="unavailable"
      />
    );
  }

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Prévu vs Réalisé
        </h3>
      )}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis dataKey="index" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              reversed={!isBike}
              tickFormatter={isBike ? (v: number) => `${v}W` : (v: number) => formatPaceDecimal(v)}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
              formatter={(value: number, name: string) => {
                const label = name === "planned" ? "Prévu" : "Réalisé";
                return [isBike ? `${Math.round(value)} W` : formatPaceDecimal(value), label];
              }}
              labelFormatter={(l) => `Intervalle ${l}`}
            />
            <Legend
              formatter={(value) => (value === "planned" ? "Prévu" : "Réalisé")}
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar dataKey="planned" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="actual" fill="#2563EB" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
