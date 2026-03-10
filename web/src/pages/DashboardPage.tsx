import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { FeatureNotice } from "@/components/ui/FeatureNotice";
import { MLS_LEVEL, SPORT_ICONS } from "@/lib/constants";
import { useLoad } from "@/hooks/useLoad";
import { useAthletes } from "@/hooks/useAthletes";
import { useReadiness } from "@/hooks/useReadiness";
import { getRecentActivities } from "@/repositories/activity.repository";
import { formatDuration } from "@/services/format.service";

type RecentActivity = Awaited<ReturnType<typeof getRecentActivities>>[number];

export function DashboardPage() {
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const { heatmapData, isLoading: loadLoading } = useLoad(12);
  const { healthData, isLoading: readinessLoading } = useReadiness();

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    getRecentActivities(5)
      .then(setRecentActivities)
      .catch(console.error)
      .finally(() => setRecentLoading(false));
  }, []);

  // KPI: sessions this week (ISO week, Mon-Sun)
  const sessionsThisWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return recentActivities.filter(
      (a) => new Date(a.session_date) >= monday
    ).length;
  }, [recentActivities]);

  // Alertes: athletes with negative rMSSD trends
  const alerts = useMemo(() => {
    return healthData
      .filter((r) => r.tendance_rmssd_pct !== null && r.tendance_rmssd_pct < -5)
      .sort((a, b) => (a.tendance_rmssd_pct ?? 0) - (b.tendance_rmssd_pct ?? 0));
  }, [healthData]);

  const criticalAlertCount = useMemo(() => {
    return healthData.filter(
      (r) => r.tendance_rmssd_pct !== null && r.tendance_rmssd_pct < -10
    ).length;
  }, [healthData]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span>/ Vue d'ensemble</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              icon="search"
              placeholder="Recherche globale non branchée"
              disabled
              title="La recherche globale n'est pas branchée dans cette version de la web app."
            />
          </div>
          <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Icon name="notifications" className="text-2xl" />
            {criticalAlertCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent-orange rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>
          <Button
            disabled
            title="La création de séance n'est pas branchée dans cette version de la web app."
          >
            Nouvelle séance
          </Button>
        </div>
      </div>

      <FeatureNotice
        title="Dashboard partiellement branché"
        description="Les KPI, alertes et activités récentes viennent bien de Supabase. La recherche, les regroupements de cohortes et la création de séance restent visibles mais non branchés."
        status="partial"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Athlètes actifs</p>
                <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                  {athletesLoading ? "—" : athletes.length}
                </h3>
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon name="group" className="text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Séances cette semaine</p>
                <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                  {recentLoading ? "—" : sessionsThisWeek}
                </h3>
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon name="trending_up" className="text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Alertes critiques</p>
                <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                  {readinessLoading ? "—" : criticalAlertCount}
                </h3>
              </div>
              {criticalAlertCount > 0 && (
                <Badge variant="orange" className="mt-1">URGENT</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Heatmap Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="monitoring" className="text-slate-400" />
              Analyse de la Charge MLS (12 dernières semaines)
            </h2>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-sm border border-slate-200 dark:border-slate-800">
              <button className="px-3 py-1 text-xs font-medium rounded-sm bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white">TOUS</button>
              <button
                disabled
                className="px-3 py-1 text-xs font-medium rounded-sm text-slate-400"
                title="Le filtrage par groupe n'est pas branché."
              >
                GROUPE A
              </button>
              <button
                disabled
                className="px-3 py-1 text-xs font-medium rounded-sm text-slate-400"
                title="Le filtrage par groupe n'est pas branché."
              >
                GROUPE B
              </button>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 overflow-x-auto">
              <div className="min-w-[600px]">
                {loadLoading || !heatmapData ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                    Chargement...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {heatmapData.athletes.map((athlete) => (
                      <div key={athlete} className="flex items-center gap-4">
                        <div className="w-32 flex items-center gap-2 shrink-0">
                          <div className="w-6 h-6 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                            {athlete.charAt(0)}
                          </div>
                          <span className="text-sm font-medium truncate">{athlete}</span>
                        </div>
                        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))` }}>
                          {heatmapData.weeks.map((week) => {
                            const mls = heatmapData.getValue(athlete, week);
                            const level = MLS_LEVEL(mls);
                            return (
                              <div
                                key={week}
                                className="h-6 rounded-none cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: level.bg }}
                                title={`${week} - MLS: ${mls.toFixed(1)}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-center gap-4 text-xs font-medium text-slate-500">
                  <span>Repos</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-none bg-[#f1f5f9]" />
                    <div className="w-4 h-4 rounded-none bg-[#bfdbfe]" />
                    <div className="w-4 h-4 rounded-none bg-[#60a5fa]" />
                    <div className="w-4 h-4 rounded-none bg-[#f97316]" />
                    <div className="w-4 h-4 rounded-none bg-[#ea580c]" />
                  </div>
                  <span>Critique</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Alertes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                Alertes d'attention
              </h2>
              <span className="text-sm font-medium text-slate-400">Vue détaillée non branchée</span>
            </div>
            <div className="space-y-3">
              {readinessLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                  Chargement...
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Aucune alerte</p>
              ) : (
                alerts.slice(0, 5).map((alert) => {
                  const pct = alert.tendance_rmssd_pct ?? 0;
                  const isCritical = pct < -10;
                  return (
                    <Card key={alert.athlete_id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
                          {alert.athlete.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{alert.athlete}</p>
                          <p className="text-xs text-slate-500 truncate">rMSSD baisse {Math.abs(pct).toFixed(0)}%</p>
                        </div>
                        <Badge variant={isCritical ? "red" : "orange"}>
                          {isCritical ? "URGENT" : "RECUP"}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Activité récente */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                Activité récente
              </h2>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button className="px-3 py-1 text-xs font-medium rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">TOUT</button>
              <button disabled className="px-3 py-1 text-xs font-medium rounded-sm text-slate-400">NAT</button>
              <button disabled className="px-3 py-1 text-xs font-medium rounded-sm text-slate-400">VELO</button>
              <button disabled className="px-3 py-1 text-xs font-medium rounded-sm text-slate-400">CAP</button>
            </div>
            <div className="space-y-2">
              {recentLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                  Chargement...
                </div>
              ) : recentActivities.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Aucune activité récente</p>
              ) : (
                recentActivities.map((act) => {
                  const athleteData = act.athletes as unknown as { first_name: string; last_name: string } | null;
                  const athleteName = athleteData
                    ? `${athleteData.first_name} ${athleteData.last_name?.charAt(0) ?? ""}.`
                    : "—";
                  const sportIcon = SPORT_ICONS[act.sport_type] ?? "exercise";
                  const mls = act.load_index ?? 0;
                  const duration = act.duration_sec ? formatDuration(act.duration_sec) : "—";

                  return (
                    <div key={act.id} className="flex items-center justify-between p-2 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex items-center gap-3">
                        <Icon name={sportIcon} className="text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{athleteName}</p>
                          <p className="text-xs text-slate-500 font-mono">{duration}</p>
                        </div>
                      </div>
                      <Badge variant={mls > 5 ? "orange" : "slate"}>{mls.toFixed(1)}</Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
