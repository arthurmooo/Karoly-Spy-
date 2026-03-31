import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import type { HrZonesAggregate } from "@/services/stats.service";

interface HrZonesBilanProps {
  hrZones: HrZonesAggregate | null;
}

function formatZoneDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
}

export function HrZonesBilan({ hrZones }: HrZonesBilanProps) {
  const maxPercent = useMemo(() => {
    if (!hrZones) return 0;
    return Math.max(...hrZones.zones.map((z) => z.percent));
  }, [hrZones]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Zones FC — période sélectionnée
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hrZones === null ? (
          <FeatureNotice
            title="Zones FC"
            description="Requiert des données HR et un profil physio (LT1/LT2)."
            status="backend"
          />
        ) : (
          <div className="space-y-1.5">
            {hrZones.zones.map((z) => (
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
        )}
      </CardContent>
    </Card>
  );
}
