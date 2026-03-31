import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { SportChip } from "@/components/ui/SportChip";
import { getSportConfig } from "@/lib/constants";
import type { HrZonesAggregate } from "@/services/stats.service";

interface HrZonesBilanProps {
  hrZones: HrZonesAggregate | null;
  hrZonesBySport: Record<string, HrZonesAggregate>;
}

function formatZoneDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
}

export function HrZonesBilan({ hrZones, hrZonesBySport }: HrZonesBilanProps) {
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const sportsWithHrData = useMemo(
    () =>
      Object.entries(hrZonesBySport)
        .sort(([, a], [, b]) => b.totalSec - a.totalSec)
        .map(([key]) => key),
    [hrZonesBySport]
  );

  const activeZones =
    selectedSport && hrZonesBySport[selectedSport]
      ? hrZonesBySport[selectedSport]
      : hrZones;

  const maxPercent = useMemo(() => {
    if (!activeZones) return 0;
    return Math.max(...activeZones.zones.map((z) => z.percent));
  }, [activeZones]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Zones FC — période sélectionnée
        </CardTitle>
        {sportsWithHrData.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <SportChip
              label="Tous"
              isActive={selectedSport === null}
              onClick={() => setSelectedSport(null)}
            />
            {sportsWithHrData.map((key) => {
              const config = getSportConfig(key);
              return (
                <SportChip
                  key={key}
                  label={config.label}
                  icon={config.icon}
                  isActive={selectedSport === key}
                  onClick={() => setSelectedSport(key)}
                />
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {activeZones === null ? (
          <FeatureNotice
            title="Zones FC"
            description="Requiert des données HR et un profil physio (LT1/LT2)."
            status="backend"
          />
        ) : (
          <div className="space-y-1.5">
            {activeZones.zones.map((z) => (
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
