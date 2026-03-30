import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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


interface TooltipPayloadItem {
  payload: ChartRow;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-md p-3 text-sm">
      <p className="font-medium text-slate-900 dark:text-white mb-1">{row.name}</p>
      <p className="text-slate-600 dark:text-slate-300">
        {row.value.toFixed(1).replace(".", ",")} %
        {" · "}
        {row.hours.toFixed(1).replace(".", ",")} h
        {row.distanceKm > 0
          ? ` · ${row.distanceKm.toFixed(0)} km`
          : ""}
      </p>
      {row.avgRpe != null && (
        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
          RPE moyen : {row.avgRpe.toFixed(1).replace(".", ",")}
        </p>
      )}
    </div>
  );
}

export function VolumeDistribution({ items }: VolumeDistributionProps) {
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

  if (items.length === 0) {
    return (
      <FeatureNotice
        title="Répartition du volume"
        description="Aucune séance exploitable sur la période sélectionnée."
        status="unavailable"
      />
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Répartition du volume
        </CardTitle>
        <p className="text-sm text-slate-500">Volume calculé sur le temps d'entraînement cumulé.</p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 12, bottom: 0 }}>
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
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                content={<CustomTooltip />}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
