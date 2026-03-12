import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { getActivitiesCountForDay, getRecentActivities } from "@/repositories/activity.repository";
import { formatDuration } from "@/services/format.service";
import { normalizeSportKey } from "@/services/activity.service";

type RecentActivity = Awaited<ReturnType<typeof getRecentActivities>>[number];
type RecentActivityTab = "TOUT" | "NAT" | "VELO" | "CAP";

const RECENT_ACTIVITY_TABS: RecentActivityTab[] = ["TOUT", "NAT", "VELO", "CAP"];

export function DashboardPage() {
  const navigate = useNavigate();
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const { heatmapData, isLoading: loadLoading } = useLoad(12);
  const { healthData, isLoading: readinessLoading } = useReadiness();

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [recentTab, setRecentTab] = useState<RecentActivityTab>("TOUT");
  const [recentLoading, setRecentLoading] = useState(true);
  const [todaySessionsCount, setTodaySessionsCount] = useState<number | null>(null);
  const [todaySessionsLoading, setTodaySessionsLoading] = useState(true);

  useEffect(() => {
    getRecentActivities(24)
      .then(setRecentActivities)
      .catch(console.error)
      .finally(() => setRecentLoading(false));
  }, []);

  useEffect(() => {
    getActivitiesCountForDay(new Date())
      .then(setTodaySessionsCount)
      .catch((error) => {
        console.error(error);
        setTodaySessionsCount(0);
      })
      .finally(() => setTodaySessionsLoading(false));
  }, []);

  // Alertes: athletes outside the SWC band
  const alerts = useMemo(() => {
    return healthData
      .filter((row) => row.swc_status === "above_swc" || row.swc_status === "below_swc")
      .sort((left, right) => left.athlete.localeCompare(right.athlete, "fr"));
  }, [healthData]);

  const criticalAlertCount = useMemo(() => {
    return healthData.filter(
      (row) => row.swc_status === "above_swc" || row.swc_status === "below_swc"
    ).length;
  }, [healthData]);

  const filteredRecentActivities = useMemo(() => {
    const scopedActivities =
      recentTab === "TOUT"
        ? recentActivities
        : recentActivities.filter((activity) => normalizeSportKey(activity.sport_type ?? "") === recentTab);

    return scopedActivities.slice(0, 5);
  }, [recentActivities, recentTab]);

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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Séances du jour</p>
                <h3 className="text-2xl font-semibold font-mono text-slate-900 dark:text-white">
                  {todaySessionsLoading ? "—" : todaySessionsCount}
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
            <CardContent className="p-6 overflow-x-auto overflow-y-visible">
              <div className="min-w-[600px]">
                {loadLoading || !heatmapData ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                    Chargement...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {heatmapData.athletes.map((athlete) => {
                      const thresholds = heatmapData.getAthleteThresholds(athlete);
                      return (
                      <div key={athlete} className="flex items-center gap-4">
                        <div className="w-32 flex items-center gap-2 shrink-0">
                          <div className="w-6 h-6 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                            {athlete.charAt(0)}
                          </div>
                          <span className="text-sm font-medium truncate">{athlete}</span>
                        </div>
                        <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))` }}>
                          {heatmapData.weeks.map((week) => {
                            const cell = heatmapData.getCell(athlete, week);
                            const mls = cell?.mls ?? 0;
                            const level = MLS_LEVEL(mls, thresholds);
                            const weekLabel = new Date(week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                            return (
                              <div
                                key={week}
                                className="relative group h-6 rounded-none cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: level.bg }}
                              >
                                {cell && mls > 0 && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-xl px-3 py-2 min-w-[140px] whitespace-nowrap">
                                      <p className="font-semibold text-slate-200 mb-1">Sem. du {weekLabel}</p>
                                      <p className="flex justify-between gap-3">
                                        <span className="text-slate-400">Charge MLS</span>
                                        <span className="font-medium">{Math.round(mls).toLocaleString("fr-FR")}</span>
                                      </p>
                                      {cell.heures != null && (
                                        <p className="flex justify-between gap-3">
                                          <span className="text-slate-400">Heures</span>
                                          <span className="font-medium">{cell.heures.toFixed(1)} h</span>
                                        </p>
                                      )}
                                      {cell.nb_seances != null && (
                                        <p className="flex justify-between gap-3">
                                          <span className="text-slate-400">Séances</span>
                                          <span className="font-medium">{cell.nb_seances}</span>
                                        </p>
                                      )}
                                      {cell.mls_moyen_intervalles != null && (
                                        <p className="flex justify-between gap-3">
                                          <span className="text-slate-400">MLS intv.</span>
                                          <span className="font-medium">{Math.round(cell.mls_moyen_intervalles).toLocaleString("fr-FR")}</span>
                                        </p>
                                      )}
                                      <p className="mt-1 pt-1 border-t border-slate-700 dark:border-slate-600 text-center" style={{ color: level.bg }}>
                                        {level.label}
                                      </p>
                                    </div>
                                    <div className="w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45 mx-auto -mt-1" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}

                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
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
                  <p className="text-[10px] text-slate-400 italic">niveaux relatifs à l'historique de chaque athlète</p>
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
              <span className="text-sm font-medium text-slate-400">Cliquer pour ouvrir le détail</span>
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
                  const isCritical = alert.swc_status === "below_swc";
                  return (
                    <Card
                      key={alert.athlete_id}
                      className="transition-colors hover:bg-primary/5 dark:hover:bg-primary/10"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/athletes/${alert.athlete_id}/trends`)}
                        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                        aria-label={`Ouvrir le rapport détaillé de ${alert.athlete}`}
                      >
                        <CardContent className="p-3 flex items-center gap-3 cursor-pointer">
                        <div className="w-8 h-8 rounded-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
                          {alert.athlete.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{alert.athlete}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {alert.swc_status === "above_swc"
                              ? "LnRMSSD 7j au-dessus de la SWC"
                              : "LnRMSSD 7j en-dessous de la SWC"}
                          </p>
                        </div>
                        <Badge variant={isCritical ? "red" : "orange"}>
                          {isCritical ? "LOW/REST" : "SWC"}
                        </Badge>
                        </CardContent>
                      </button>
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
              {RECENT_ACTIVITY_TABS.map((tab) => {
                const isActive = tab === recentTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRecentTab(tab)}
                    className={
                      isActive
                        ? "px-3 py-1 text-xs font-medium rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        : "px-3 py-1 text-xs font-medium rounded-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
                    }
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {recentLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                  Chargement...
                </div>
              ) : filteredRecentActivities.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  {recentTab === "TOUT"
                    ? "Aucune activité récente"
                    : `Aucune activité récente pour ${recentTab}`}
                </p>
              ) : (
                filteredRecentActivities.map((act) => {
                  const athleteData = act.athletes as unknown as { first_name: string; last_name: string } | null;
                  const athleteName = athleteData
                    ? `${athleteData.first_name} ${athleteData.last_name?.charAt(0) ?? ""}.`
                    : "—";
                  const sportKey = normalizeSportKey(act.sport_type ?? "");
                  const sportIcon = SPORT_ICONS[sportKey] ?? "exercise";
                  const averageHr = act.avg_hr != null ? `${Math.round(act.avg_hr)} bpm` : null;
                  const duration = (act as { moving_time_sec?: number | null }).moving_time_sec
                    ? formatDuration((act as { moving_time_sec: number }).moving_time_sec)
                    : act.duration_sec ? formatDuration(act.duration_sec) : "—";

                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => navigate(`/activities/${act.id}`)}
                      className="w-full flex items-center justify-between p-2 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon name={sportIcon} className="text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{athleteName}</p>
                          <p className="text-xs text-slate-500 font-mono">{duration}</p>
                        </div>
                      </div>
                      {averageHr ? (
                        <Badge variant="slate">{averageHr}</Badge>
                      ) : (
                        <span className="text-sm text-slate-400 font-mono">--</span>
                      )}
                    </button>
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
