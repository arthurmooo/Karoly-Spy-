import { useState } from "react";
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
  const [hovered, setHovered] = useState<string | null>(null);

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
          <div className="space-y-4">
            {/* Segmented bar */}
            <div className="flex h-6 rounded-full overflow-hidden gap-px">
              {hrZones.zones.map((z) => (
                <div
                  key={z.zone}
                  className="relative cursor-default transition-opacity duration-100"
                  style={{
                    flex: z.seconds,
                    minWidth: z.percent > 1 ? 4 : 0,
                    opacity: hovered && hovered !== z.zone ? 0.5 : 1,
                  }}
                  onMouseEnter={() => setHovered(z.zone)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="h-full" style={{ backgroundColor: z.color }} />
                  {hovered === z.zone && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-900 dark:bg-slate-100 px-2 py-1 text-xs text-white dark:text-slate-900 shadow z-10 pointer-events-none">
                      {z.zone} · {z.percent.toFixed(1)}% · {formatZoneDuration(z.seconds)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {hrZones.zones.map((z) => (
                <div
                  key={z.zone}
                  className="flex items-center gap-2"
                  onMouseEnter={() => setHovered(z.zone)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="w-3 h-3 rounded-lg shrink-0"
                    style={{ backgroundColor: z.color }}
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-900 dark:text-white">{z.zone}</span>
                    {" "}· {z.percent.toFixed(0)}% · {formatZoneDuration(z.seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
