import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { AcwrStatusBadge } from "@/components/load/AcwrStatusBadge";
import { MLS_LEVEL, SPORT_ICONS } from "@/lib/constants";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { WORK_TYPE_OPTIONS } from "@/services/filter.service";
import { useLoad } from "@/hooks/useLoad";
import { useAcwr } from "@/hooks/useAcwr";
import { useAthletes } from "@/hooks/useAthletes";
import { useAthleteGroups } from "@/hooks/useAthleteGroups";
import { useReadiness } from "@/hooks/useReadiness";
import { getActivitiesCountForDay, getRecentActivities } from "@/repositories/activity.repository";
import { formatDuration } from "@/services/format.service";
import { normalizeSportKey } from "@/services/activity.service";
import { buildAcwrDashboardSummary } from "@/services/load.service";
import type { AcwrMetricKind, AcwrSnapshotRow, AcwrStatus } from "@/types/acwr";

type RecentActivity = Awaited<ReturnType<typeof getRecentActivities>>[number];
type RecentActivityTab = "TOUT" | "NAT" | "VELO" | "CAP";
type AcwrSortBy = "athlete" | "external" | "internal" | "global";

const RECENT_ACTIVITY_TABS: RecentActivityTab[] = ["TOUT", "NAT", "VELO", "CAP"];

function getAcwrSortWeight(status: AcwrStatus): number {
  switch (status) {
    case "alert":
      return 4;
    case "warning":
      return 3;
    case "ok":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function formatAcwrTooltip(row: AcwrSnapshotRow, metric: AcwrMetricKind) {
  const snapshot = row[metric];
  const acute = snapshot.acute_7d?.toFixed(1) ?? "—";
  const chronic = snapshot.chronic_28d_weekly_equiv?.toFixed(1) ?? "—";
  return `Aiguë 7j: ${acute} · Chronique 28j/4: ${chronic}`;
}

const TODAY_LABEL = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const { groups } = useAthleteGroups();
  const { heatmapData, isLoading: loadLoading } = useLoad(12);
  const { cohort: acwrCohort, isLoading: acwrLoading } = useAcwr();
  const { healthData, isLoading: readinessLoading } = useReadiness();

  const [heatmapGroup, setHeatmapGroup] = useState<string | null>(null);
  const [acwrSortBy, setAcwrSortBy] = useState<AcwrSortBy>("athlete");
  const [acwrSortDir, setAcwrSortDir] = useState<SortDirection>("asc");

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [recentTab, setRecentTab] = useState<RecentActivityTab>("TOUT");
  const [recentWorkType, setRecentWorkType] = useState("");
  const [recentLoading, setRecentLoading] = useState(true);
  const [todaySessionsCount, setTodaySessionsCount] = useState<number | null>(null);
  const [todaySessionsLoading, setTodaySessionsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    setRecentLoading(true);
    getRecentActivities(24)
      .then(setRecentActivities)
      .catch(console.error)
      .finally(() => setRecentLoading(false));
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading) return;

    setTodaySessionsLoading(true);
    getActivitiesCountForDay(new Date())
      .then(setTodaySessionsCount)
      .catch((error) => {
        console.error(error);
        setTodaySessionsCount(0);
      })
      .finally(() => setTodaySessionsLoading(false));
  }, [authLoading, user?.id]);

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
    let scopedActivities =
      recentTab === "TOUT"
        ? recentActivities
        : recentActivities.filter((activity) => normalizeSportKey(activity.sport_type ?? "") === recentTab);

    if (recentWorkType) {
      scopedActivities = scopedActivities.filter(
        (activity) => activity.work_type === recentWorkType
      );
    }

    return scopedActivities.slice(0, 5);
  }, [recentActivities, recentTab, recentWorkType]);

  const acwrRows = useMemo(
    () =>
      sortRows(
        acwrCohort,
        (row) => {
          switch (acwrSortBy) {
            case "external":
              return row.external.ratio ?? getAcwrSortWeight(row.external.status);
            case "internal":
              return row.internal.ratio ?? getAcwrSortWeight(row.internal.status);
            case "global":
              return row.global.ratio ?? getAcwrSortWeight(row.global.status);
            case "athlete":
            default:
              return row.athlete;
          }
        },
        acwrSortDir
      ),
    [acwrCohort, acwrSortBy, acwrSortDir]
  );

  const acwrSummary = useMemo(() => {
    return buildAcwrDashboardSummary(acwrCohort);
  }, [acwrCohort]);

  const handleAcwrSort = (column: AcwrSortBy) => {
    if (acwrSortBy !== column) {
      setAcwrSortBy(column);
      setAcwrSortDir(column === "athlete" ? "asc" : "desc");
      return;
    }

    setAcwrSortDir((current) => (current === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="space-y-4">
      {/* ── Header compact ── */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Vue d'ensemble
        </h1>
        <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
          {TODAY_LABEL}
        </span>
      </div>

      {/* ── Row 1 — 4 KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Athlètes actifs</p>
                <h3 className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
                  {athletesLoading ? "—" : athletes.length}
                </h3>
              </div>
              <Icon name="group" className="text-emerald-600 dark:text-emerald-400 text-sm" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Séances du jour</p>
                <h3 className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
                  {todaySessionsLoading ? "—" : todaySessionsCount}
                </h3>
              </div>
              <Icon name="trending_up" className="text-emerald-600 dark:text-emerald-400 text-sm" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Alertes SWC</p>
                <h3 className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
                  {readinessLoading ? "—" : criticalAlertCount}
                </h3>
              </div>
              {criticalAlertCount > 0 && (
                <Badge variant="orange" className="mt-1">URGENT</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">ACWR alertes</p>
                <h3 className="text-xl font-semibold font-mono text-slate-900 dark:text-white">
                  {acwrLoading ? "—" : acwrSummary.alertCount}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {acwrLoading
                    ? ""
                    : `${acwrSummary.warningCount} vigilance · ${acwrSummary.insufficientCount} incomplets`}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-1.5 rounded-sm">
                <Icon name="warning_amber" className="text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2×2 Grid — Monitoring + Feed ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Heatmap MLS */}
        <Card className="xl:h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="monitoring" className="text-slate-400" />
              Charge MLS
            </h2>
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg overflow-x-auto">
              <button
                onClick={() => setHeatmapGroup(null)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all duration-150 whitespace-nowrap ${
                  heatmapGroup === null
                    ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Tous
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setHeatmapGroup(g.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-all duration-150 whitespace-nowrap ${
                    heatmapGroup === g.id
                      ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <CardContent className="p-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto">
            <div className="min-w-[500px]">
              {loadLoading || !heatmapData ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                  Chargement...
                </div>
              ) : (
                <div className="px-4 pt-4">
                  <div className="space-y-2">
                    {heatmapData.athletes.filter((athleteName) => {
                      if (!heatmapGroup) return true;
                      const match = athletes.find((a) => `${a.first_name} ${a.last_name}` === athleteName || `${a.last_name} ${a.first_name}` === athleteName);
                      return match?.athlete_group_id === heatmapGroup;
                    }).map((athlete) => {
                      const thresholds = heatmapData.getAthleteThresholds(athlete);
                      const athleteMatch = athletes.find((a) => `${a.first_name} ${a.last_name}` === athlete || `${a.last_name} ${a.first_name}` === athlete);
                      return (
                      <button
                        key={athlete}
                        type="button"
                        onClick={() => athleteMatch && navigate(`/athletes/${athleteMatch.id}/trends`)}
                        className="flex items-center gap-4 w-full text-left rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="w-28 flex items-center gap-2 shrink-0">
                          <div className="w-5 h-5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-medium border border-slate-200 dark:border-slate-700">
                            {athlete.charAt(0)}
                          </div>
                          <span className="text-xs font-medium truncate">{athlete}</span>
                        </div>
                        <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))` }}>
                          {heatmapData.weeks.map((week, weekIdx) => {
                            const cell = heatmapData.getCell(athlete, week);
                            const mls = cell?.mls ?? 0;
                            const level = MLS_LEVEL(mls, thresholds);
                            const weekLabel = new Date(week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                            const isLast = weekIdx === heatmapData.weeks.length - 1;
                            return (
                              <div
                                key={week}
                                className="relative group h-5 rounded-none cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: level.bg }}
                              >
                                {cell && mls > 0 && (
                                  <div className={`absolute bottom-full mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isLast ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
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
                                    <div className={`w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45 -mt-1 ${isLast ? "ml-auto mr-4" : "mx-auto"}`} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </button>
                    );
                    })}
                  </div>
                </div>
              )}

            </div>
          </CardContent>
          <div className="px-4 py-3 flex items-center justify-center gap-3 text-xs font-medium text-slate-500 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <span>Repos</span>
            <div className="flex gap-0.5">
              <div className="w-3.5 h-3.5 rounded-none bg-[#f1f5f9]" />
              <div className="w-3.5 h-3.5 rounded-none bg-[#bfdbfe]" />
              <div className="w-3.5 h-3.5 rounded-none bg-[#60a5fa]" />
              <div className="w-3.5 h-3.5 rounded-none bg-[#f97316]" />
              <div className="w-3.5 h-3.5 rounded-none bg-[#ea580c]" />
            </div>
            <span>Critique</span>
          </div>
        </Card>

        {/* ACWR Cohorte */}
        <Card className="xl:h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Icon name="groups" className="text-slate-400" />
              ACWR cohorte
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">Cliquer sur une ligne</span>
          </div>
          {/* Sticky thead + scrollable tbody */}
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <SortableHeader
                    label="Athlète"
                    active={acwrSortBy === "athlete"}
                    direction={acwrSortDir}
                    onToggle={() => handleAcwrSort("athlete")}
                    className="px-2 py-2"
                  />
                  <SortableHeader
                    label="Ext."
                    active={acwrSortBy === "external"}
                    direction={acwrSortDir}
                    onToggle={() => handleAcwrSort("external")}
                    className="px-2 py-2"
                  />
                  <SortableHeader
                    label="Int."
                    active={acwrSortBy === "internal"}
                    direction={acwrSortDir}
                    onToggle={() => handleAcwrSort("internal")}
                    className="px-2 py-2"
                  />
                  <SortableHeader
                    label="Glob."
                    active={acwrSortBy === "global"}
                    direction={acwrSortDir}
                    onToggle={() => handleAcwrSort("global")}
                    className="px-2 py-2"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {acwrLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      Chargement ACWR...
                    </td>
                  </tr>
                ) : acwrRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      Aucune donnée ACWR disponible.
                    </td>
                  </tr>
                ) : (
                  acwrRows.map((row) => (
                    <tr
                      key={row.athlete_id}
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/athletes/${row.athlete_id}/trends#acwr`)}
                    >
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {row.athlete.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">
                            {row.athlete}
                          </span>
                        </div>
                      </td>
                      {(["external", "internal", "global"] as const).map((metric) => (
                        <td
                          key={metric}
                          className="px-2 py-2 whitespace-nowrap"
                          title={formatAcwrTooltip(row, metric)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white min-w-[2rem]">
                              {row[metric].ratio !== null
                                ? row[metric].ratio.toFixed(2)
                                : "—"}
                            </span>
                            <AcwrStatusBadge status={row[metric].status} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Activité récente */}
        <Card className="xl:h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-2 shrink-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
              Activité récente
            </h2>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {RECENT_ACTIVITY_TABS.map((tab) => {
                const isActive = tab === recentTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRecentTab(tab)}
                    className={
                      isActive
                        ? "px-2 py-0.5 text-[11px] font-medium rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        : "px-2 py-0.5 text-[11px] font-medium rounded-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
                    }
                  >
                    {tab}
                  </button>
                );
              })}
              <select
                value={recentWorkType}
                onChange={(e) => setRecentWorkType(e.target.value)}
                className="ml-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Tous types</option>
                {WORK_TYPE_OPTIONS.map((wt) => (
                  <option key={wt.value} value={wt.value}>
                    {wt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CardContent className="p-3 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-1">
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
                      data-testid={`recent-activity-${act.id}`}
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
          </CardContent>
        </Card>

        {/* Alertes SWC */}
        <Card className="xl:h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              Alertes d'attention
              {!readinessLoading && criticalAlertCount > 0 && (
                <Badge variant="orange">{criticalAlertCount}</Badge>
              )}
            </h2>
            <span className="text-[10px] text-slate-400 hidden sm:inline">Cliquer pour ouvrir</span>
          </div>
          <CardContent className="p-3 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2">
              {readinessLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Icon name="progress_activity" className="text-2xl animate-spin mr-2" />
                  Chargement...
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Aucune alerte</p>
              ) : (
                alerts.map((alert) => {
                  const isCritical = alert.swc_status === "below_swc";
                  return (
                    <button
                      key={alert.athlete_id}
                      type="button"
                      onClick={() => navigate(`/athletes/${alert.athlete_id}/trends`)}
                      className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-sm transition-colors hover:bg-primary/5 dark:hover:bg-primary/10"
                      aria-label={`Ouvrir le rapport détaillé de ${alert.athlete}`}
                      data-testid={`health-alert-${alert.athlete_id}`}
                    >
                      <div className="p-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-400 shrink-0">
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
                          {isCritical ? "LOW" : "SWC"}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
