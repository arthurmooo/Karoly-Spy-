import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { useReadiness } from "@/hooks/useReadiness";
import { getAthleteById } from "@/repositories/athlete.repository";
import type { Athlete } from "@/types/athlete";

export function AthleteTrendsPage() {
  const { id } = useParams();
  const { readinessSeries, healthData, isLoading } = useReadiness(id);
  const [athlete, setAthlete] = useState<Athlete | null>(null);

  useEffect(() => {
    if (!id) return;
    getAthleteById(id).then(setAthlete).catch(console.error);
  }, [id]);

  // --- Derived data ---

  const athleteName = athlete
    ? `${athlete.first_name} ${athlete.last_name.charAt(0)}.`
    : "...";

  const dateRange = useMemo(() => {
    if (readinessSeries.length === 0) return "Aucune donnée";
    const first = readinessSeries[0]!.date;
    const last = readinessSeries[readinessSeries.length - 1]!.date;
    return `${format(new Date(first), "d MMM", { locale: fr })} — ${format(new Date(last), "d MMM yyyy", { locale: fr })}`;
  }, [readinessSeries]);

  // Last 7 entries for mini bar charts
  const last7 = readinessSeries.slice(-7);

  // Latest readiness entry
  const latest = readinessSeries.length > 0 ? readinessSeries[readinessSeries.length - 1] : null;

  // rMSSD card
  const latestRmssd = latest?.rmssd ?? null;
  const avg30dRmssd = latest?.rmssd_30d_avg ?? null;
  const rmssdTrend =
    latestRmssd !== null && avg30dRmssd !== null && avg30dRmssd !== 0
      ? ((latestRmssd - avg30dRmssd) / avg30dRmssd) * 100
      : null;

  // FC repos card
  const latestHr = latest?.resting_hr ?? null;
  const avg30dHr = latest?.resting_hr_30d_avg ?? null;
  const hrDiff = latestHr !== null && avg30dHr !== null ? latestHr - avg30dHr : null;

  // Poids from healthData
  const athleteHealth = healthData.find((h) => h.athlete_id === id);
  const poids = athleteHealth?.poids ?? null;

  // Chart data
  const chartData = useMemo(
    () =>
      readinessSeries
        .filter((r) => r.rmssd !== null)
        .map((r) => ({
          date: format(new Date(r.date), "dd/MM"),
          rmssd: r.rmssd,
        })),
    [readinessSeries],
  );

  // SWC band: mean +/- 0.5 * SD
  const { swcLow, swcHigh } = useMemo(() => {
    const values = readinessSeries.map((r) => r.rmssd).filter((v): v is number => v !== null);
    if (values.length < 2) return { swcLow: undefined, swcHigh: undefined };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
    return { swcLow: Math.round((mean - 0.5 * sd) * 10) / 10, swcHigh: Math.round((mean + 0.5 * sd) * 10) / 10 };
  }, [readinessSeries]);

  // Alertes
  const alertes = useMemo(() => {
    if (!latest || latestRmssd === null || avg30dRmssd === null) return [];
    const items: { type: "green" | "orange" | "neutral"; title: string; text: string; icon: string; date: string }[] = [];

    if (latestRmssd > avg30dRmssd) {
      items.push({
        type: "green",
        title: "Statut Optimal",
        text: "rMSSD supérieur à la moyenne des 30 derniers jours. Excellente assimilation de la charge.",
        icon: "check_circle",
        date: format(new Date(latest.date), "EEEE d MMM, HH:mm", { locale: fr }),
      });
    } else if (latestRmssd < avg30dRmssd * 0.9) {
      items.push({
        type: "orange",
        title: "Récupération Incomplète",
        text: "Baisse significative du rMSSD par rapport à la moyenne 30j. Surveiller la récupération.",
        icon: "warning_amber",
        date: format(new Date(latest.date), "EEEE d MMM, HH:mm", { locale: fr }),
      });
    } else {
      items.push({
        type: "neutral",
        title: "Normal",
        text: "rMSSD dans la plage normale par rapport à la moyenne des 30 derniers jours.",
        icon: "info",
        date: format(new Date(latest.date), "EEEE d MMM, HH:mm", { locale: fr }),
      });
    }
    return items;
  }, [latest, latestRmssd, avg30dRmssd]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  // --- Empty state ---
  if (readinessSeries.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
              <Link to="/profiles" className="hover:text-primary transition-colors">Athlètes</Link>
              <Icon name="chevron_right" className="text-lg" />
              <span className="text-slate-700 dark:text-slate-300">{athleteName}</span>
            </div>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Rapport de Santé Détaillé</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Icon name="monitoring" className="text-4xl text-slate-400" />
          <p className="text-sm text-slate-500">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  // --- Helpers for mini bars ---
  const maxRmssd = Math.max(...last7.map((d) => d.rmssd ?? 0), 1);
  const maxHr = Math.max(...last7.map((d) => d.resting_hr ?? 0), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
            <Link to="/profiles" className="hover:text-primary transition-colors">Athlètes</Link>
            <Icon name="chevron_right" className="text-lg" />
            <span className="text-slate-700 dark:text-slate-300">{athleteName}</span>
          </div>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Rapport de Santé Détaillé</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analyse des tendances biométriques • {dateRange}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            disabled
            title="L'export n'est pas branché dans cette version de la web app."
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Icon name="share" />
            Exporter
          </Button>
          <Button
            disabled
            title="Le changement de période n'est pas branché dans cette version de la web app."
            className="bg-primary text-white shadow-sm"
          >
            <Icon name="calendar_today" />
            Période
          </Button>
        </div>
      </div>

      <FeatureNotice
        title="Vue tendances partiellement branchée"
        description="Les courbes readiness et les cartes viennent bien de Supabase. L'export et le changement de période restent visibles mais ne sont pas encore connectés."
        status="partial"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">rMSSD</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white font-mono">
                    {latestRmssd !== null ? latestRmssd.toFixed(1) : "—"}
                  </h3>
                  {rmssdTrend !== null && (
                    <span className={`text-sm font-medium ${rmssdTrend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {rmssdTrend >= 0 ? "+" : ""}{rmssdTrend.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-1 h-12">
                {last7.map((d, i) => (
                  <div key={i} className="w-2 bg-primary rounded-none" style={{ height: `${((d.rmssd ?? 0) / maxRmssd) * 100}%` }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {rmssdTrend !== null && rmssdTrend >= 0
                ? "Variabilité cardiaque stable et optimale."
                : "Variabilité cardiaque en baisse."}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">FC au repos</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white font-mono">
                    {latestHr !== null ? latestHr : "—"}
                  </h3>
                  {hrDiff !== null && (
                    <span className={`text-sm font-medium ${hrDiff <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {hrDiff <= 0 ? "" : "+"}{hrDiff} bpm
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-1 h-12">
                {last7.map((d, i) => (
                  <div key={i} className="w-2 bg-accent-orange rounded-none" style={{ height: `${((d.resting_hr ?? 0) / maxHr) * 100}%` }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {hrDiff !== null && hrDiff <= 0
                ? "Baisse positive de la fréquence cardiaque."
                : "Fréquence cardiaque au repos en hausse."}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Poids</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white font-mono">
                    {poids !== null ? poids.toFixed(1) : "—"}
                  </h3>
                  <span className="text-sm font-medium text-slate-500">kg</span>
                </div>
              </div>
              <div className="flex items-end gap-1 h-12">
                {last7.map((_, i) => (
                  <div key={i} className="w-2 bg-slate-300 dark:bg-slate-600 rounded-none" style={{ height: `${poids !== null ? 85 : 0}%` }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {poids !== null ? "Dernière mesure disponible." : "Aucune donnée de poids."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Icon name="show_chart" className="text-slate-500 dark:text-slate-400" />
            Tendances rMSSD
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--tw-colors-slate-800)', borderRadius: '8px', border: '1px solid var(--tw-colors-slate-700)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#f8fafc' }}
                  itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                />
                {swcLow !== undefined && swcHigh !== undefined && (
                  <ReferenceArea y1={swcLow} y2={swcHigh} className="fill-slate-200 dark:fill-slate-700/20" />
                )}
                <Line type="monotone" dataKey="rmssd" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: 'var(--tw-colors-slate-900)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alertes & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alertes */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="warning" className="text-slate-500 dark:text-slate-400" />
            Alertes Récentes
          </h3>
          <div className="space-y-3">
            {alertes.map((alerte, i) => (
              <div
                key={i}
                className={`bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 border-l-4 rounded-md p-4 flex items-start gap-3 ${
                  alerte.type === "green"
                    ? "border-l-emerald-500"
                    : alerte.type === "orange"
                      ? "border-l-accent-orange"
                      : "border-l-slate-400"
                }`}
              >
                <Icon
                  name={alerte.icon}
                  className={`mt-0.5 ${
                    alerte.type === "green"
                      ? "text-emerald-500"
                      : alerte.type === "orange"
                        ? "text-accent-orange"
                        : "text-slate-400"
                  }`}
                />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{alerte.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{alerte.text}</p>
                  <span className="text-[10px] font-semibold text-slate-500 mt-2 block uppercase tracking-wider">{alerte.date}</span>
                </div>
              </div>
            ))}
            {alertes.length === 0 && (
              <p className="text-sm text-slate-500">Aucune alerte.</p>
            )}
          </div>
        </div>

        {/* Notes Coach */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="comment" className="text-slate-500 dark:text-slate-400" />
            Notes Coach
          </h3>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-slate-700 dark:text-white">
                  KS
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Karoly Spy</h4>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Hier, 18:30</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                Excellente semaine d'entraînement. La FC de repos continue de baisser malgré l'augmentation du volume. On maintient la charge pour la semaine prochaine avant d'entamer le cycle d'affûtage.
              </p>
              <div className="flex items-center gap-3">
                <Button className="flex-1 bg-primary hover:bg-primary-light text-white">Répondre</Button>
                <Button variant="secondary" className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Approuver</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
