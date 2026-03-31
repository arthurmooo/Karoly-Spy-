import { useMemo } from "react";
import { HR_ZONE_COLORS } from "@/lib/constants";
import type { StreamPoint } from "@/types/activity";
import { FeatureNotice } from "@/components/ui/FeatureNotice";

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

function formatZoneDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
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
  const data = useMemo<ZoneData[]>(() => {
    if (!lt1Hr || !lt2Hr || lt1Hr >= lt2Hr) return [];

    const zones = computeZoneBoundaries(lt1Hr, lt2Hr);
    const buckets = zones.map(() => 0);

    // Streams are down-sampled (default 5s interval). Derive the actual
    // step so each point counts for the correct number of seconds.
    const step =
      streams.length >= 2
        ? (streams[streams.length - 1]!.t - streams[0]!.t) / (streams.length - 1)
        : 1;

    for (const pt of streams) {
      if (pt.hr == null) continue;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i]!;
        if (pt.hr >= z.min && (pt.hr < z.max || i === zones.length - 1)) {
          buckets[i] = (buckets[i] ?? 0) + step;
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

  const maxPercent = Math.max(...data.map((d) => d.percent));

  return (
    <div className="space-y-2">
      {!hideTitle && (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Distribution zones FC
        </h3>
      )}

      <div className="space-y-1.5">
        {data.map((z) => (
          <div key={z.zone} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
              {z.zone}
            </span>
            <div className="relative flex-1 h-5">
              <div
                className="h-full rounded-r-md"
                style={{
                  width: maxPercent > 0 ? `${(z.percent / maxPercent) * 100}%` : "0%",
                  minWidth: z.percent > 0 ? 4 : 0,
                  backgroundColor: z.color,
                }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {formatZoneDuration(z.seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
