import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import type { WeeklyLoadPoint } from "@/services/stats.service";

interface LoadEvolutionProps {
  points: WeeklyLoadPoint[];
}

export function LoadEvolution({ points }: LoadEvolutionProps) {
  if (points.length === 0) {
    return (
      <FeatureNotice
        title="Évolution de la charge"
        description="Aucune charge MLS disponible sur les 8 dernières semaines."
        status="unavailable"
      />
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base text-slate-900 dark:text-white">
          Évolution de la charge
        </CardTitle>
        <p className="text-sm text-slate-500">Somme MLS par semaine calendaire sur les 8 dernières semaines.</p>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="loadEvolutionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1).replace(".", ",")} MLS`}
                labelFormatter={(value: string) => `Sem. du ${value}`}
              />
              <Area
                type="monotone"
                dataKey="load"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#loadEvolutionFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
