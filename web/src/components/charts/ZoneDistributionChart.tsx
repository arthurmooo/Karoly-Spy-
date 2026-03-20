import { useMemo, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { HR_ZONE_COLORS } from "@/lib/constants";
import type { StreamPoint } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { formatDuration } from "@/services/format.service";

interface Props {
  streams: StreamPoint[];
  lt1Hr: number | null;
  lt2Hr: number | null;
}

interface ZoneData {
  zone: string;
  seconds: number;
  percent: number;
  color: string;
}

function computeZoneBoundaries(lt1: number, lt2: number) {
  const z1Mid = lt1 / 2;
  const z2Mid = lt1 + (lt2 - lt1) / 2;
  const z3Mid = lt2 + (lt2 - lt1) / 2;

  return [
    { zone: "Z1i", min: 0, max: z1Mid, color: HR_ZONE_COLORS.Z1i },
    { zone: "Z1ii", min: z1Mid, max: lt1, color: HR_ZONE_COLORS.Z1ii },
    { zone: "Z2i", min: lt1, max: z2Mid, color: HR_ZONE_COLORS.Z2i },
    { zone: "Z2ii", min: z2Mid, max: lt2, color: HR_ZONE_COLORS.Z2ii },
    { zone: "Z3i", min: lt2, max: z3Mid, color: HR_ZONE_COLORS.Z3i },
    { zone: "Z3ii", min: z3Mid, max: Infinity, color: HR_ZONE_COLORS.Z3ii },
  ];
}

export function ZoneDistributionChart({ streams, lt1Hr, lt2Hr, hideTitle }: Props & { hideTitle?: boolean }) {
  const [activeZone, setActiveZone] = useState<{ data: ZoneData; cx: number; cy: number } | null>(null);
  const TOOLTIP_W = 200;
  const TOOLTIP_H = 40;
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo<ZoneData[]>(() => {
    if (!lt1Hr || !lt2Hr || lt1Hr >= lt2Hr) return [];

    const zones = computeZoneBoundaries(lt1Hr, lt2Hr);
    const buckets = zones.map(() => 0);

    for (const pt of streams) {
      if (pt.hr == null) continue;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i]!;
        if (pt.hr >= z.min && (pt.hr < z.max || i === zones.length - 1)) {
          buckets[i] = (buckets[i] ?? 0) + 1;
          break;
        }
      }
    }

    const total = buckets.reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return zones.map((z, i) => ({
      zone: z.zone,
      seconds: buckets[i]!,
      percent: Math.round((buckets[i]! / total) * 1000) / 10,
      color: z.color,
    }));
  }, [streams, lt1Hr, lt2Hr]);

  if (!lt1Hr || !lt2Hr) {
    return (
      <FeatureNotice
        title="Distribution zones FC"
        description="Profil physio requis (LT1 & LT2 HR) pour calculer les zones de fréquence cardiaque."
        status="backend"
      />
    );
  }

  if (data.length === 0) {
    return (
      <FeatureNotice
        title="Distribution zones FC"
        description="Pas de données FC exploitables dans les streams."
        status="unavailable"
      />
    );
  }

  // Position tooltip near cursor: right of cx, flipped left if overflow; vertically centered on bar
  let tooltipX = 0;
  let tooltipY = 0;
  if (activeZone) {
    const containerW = containerRef.current?.offsetWidth ?? 600;
    const containerH = containerRef.current?.offsetHeight ?? 200;
    const GAP = 16;
    tooltipX = activeZone.cx + GAP;
    if (tooltipX + TOOLTIP_W > containerW) {
      tooltipX = activeZone.cx - TOOLTIP_W - GAP;
    }
    tooltipX = Math.max(0, tooltipX);
    tooltipY = activeZone.cy - TOOLTIP_H / 2;
    tooltipY = Math.max(0, Math.min(tooltipY, containerH - TOOLTIP_H));
  }

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Distribution zones FC
        </h3>
      )}

      <div ref={containerRef} className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state.activePayload?.length) {
                const d = state.activePayload[0].payload as ZoneData;
                setActiveZone({
                  data: d,
                  cx: state.activeCoordinate?.x ?? 0,
                  cy: state.activeCoordinate?.y ?? 0,
                });
              }
            }}
            onMouseLeave={() => setActiveZone(null)}
          >
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="zone" tick={{ fontSize: 11, fill: "#64748b" }} width={35} />
            <Bar dataKey="percent" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {activeZone && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{ left: tooltipX, top: tooltipY, transition: "left 80ms ease-out, top 80ms ease-out" }}
          >
            <span className="font-semibold text-slate-900 dark:text-white">{activeZone.data.zone}</span>
            <span className="ml-2 text-slate-500">{activeZone.data.percent}% — {formatDuration(activeZone.data.seconds)}</span>
          </div>
        )}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {data.map((d) => (
          <span key={d.zone} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            {d.zone}: {d.percent}% ({formatDuration(d.seconds)})
          </span>
        ))}
      </div>
    </div>
  );
}
