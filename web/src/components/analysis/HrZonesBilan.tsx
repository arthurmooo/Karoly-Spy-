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
  const [zoneMode, setZoneMode] = useState<"pct" | "dur">("pct");

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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-slate-900 dark:text-white">
            Zones FC — période sélectionnée
          </CardTitle>
          <div className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoneMode("pct")}
              className={`px-2 py-0.5 rounded-[4px] font-medium transition-colors ${zoneMode === "pct" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setZoneMode("dur")}
              className={`px-2 py-0.5 rounded-[4px] font-medium transition-colors ${zoneMode === "dur" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Durée
            </button>
          </div>
        </div>
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
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400 w-12 text-right">
                  {zoneMode === "pct" ? `${z.percent.toFixed(1)}%` : formatZoneDuration(z.seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
