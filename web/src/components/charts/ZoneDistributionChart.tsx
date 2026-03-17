import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
  // Z1i/Z1ii split LT1 zone in half, Z2i/Z2ii split LT1-LT2, Z3i/Z3ii split above LT2
  const z1Mid = lt1 / 2;
  const z2Mid = lt1 + (lt2 - lt1) / 2;
  // Z3 split: LT2 + half the gap above LT2 (use LT2 + (LT2-LT1) as rough upper bound)
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
  const data = useMemo<ZoneData[]>(() => {
    if (!lt1Hr || !lt2Hr || lt1Hr >= lt2Hr) return [];

    const zones = computeZoneBoundaries(lt1Hr, lt2Hr);
    const buckets = zones.map(() => 0);

    // Count seconds in each zone (streams are 1Hz, but may be sampled — count points)
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

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Distribution zones FC
        </h3>
      )}

      {/* Horizontal stacked summary bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-sm">
        {data.map((d) =>
          d.percent > 0 ? (
            <div
              key={d.zone}
              style={{ width: `${d.percent}%`, backgroundColor: d.color }}
              className="relative flex items-center justify-center"
              title={`${d.zone}: ${d.percent}%`}
            >
              {d.percent >= 8 && (
                <span className="text-[9px] font-bold text-white drop-shadow-sm">
                  {d.zone}
                </span>
              )}
            </div>
          ) : null
        )}
      </div>

      {/* Horizontal bar chart */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="zone" tick={{ fontSize: 11, fill: "#64748b" }} width={35} />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${value}% — ${formatDuration(props.payload.seconds)}`,
                props.payload.zone,
              ]}
              contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }}
            />
            <Bar dataKey="percent" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
