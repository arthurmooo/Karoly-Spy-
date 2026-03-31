import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/Dialog";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { AcwrStatusBadge } from "@/components/load/AcwrStatusBadge";
import { MLS_LEVEL, getSportConfig } from "@/lib/constants";
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
import { buildAcwrDashboardSummary, getSnapshotPriority } from "@/services/load.service";
import type { AcwrMetricKind, AcwrSnapshotRow, AcwrStatus } from "@/types/acwr";
import { StorageGauge } from "@/components/system/StorageGauge";

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
  const { athletes, isLoading: athletesLoading } = useAthletes();
  const { groups } = useAthleteGroups();
  const { heatmapData, isLoading: loadLoading } = useLoad(12);
  const { cohort: acwrCohort, isLoading: acwrLoading } = useAcwr();
  const { healthData, isLoading: readinessLoading } = useReadiness();

  const [heatmapGroup, setHeatmapGroup] = useState<string | null>(null);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const [acwrSortBy, setAcwrSortBy] = useState<AcwrSortBy>("athlete");
  const [acwrSortDir, setAcwrSortDir] = useState<SortDirection>("asc");
  const [showAcwrDialog, setShowAcwrDialog] = useState(false);

  // Close group dropdown on outside click
  useEffect(() => {
    if (!groupDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [groupDropdownOpen]);

  // Heatmap tooltip — portal-based, survives overflow:hidden
  const [heatmapTip, setHeatmapTip] = useState<{
    key: string;
    rect: DOMRect;
    mls: number;
    heures: number | null;
    nb_seances: number | null;
    mls_intv: number | null;
    weekLabel: string;
    levelBg: string;
    levelLabel: string;
  } | null>(null);
  const tipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openTip = useCallback(
    (key: string, el: HTMLElement, data: Omit<NonNullable<typeof heatmapTip>, "key" | "rect">) => {
      if (tipTimeout.current) clearTimeout(tipTimeout.current);
      setHeatmapTip({ key, rect: el.getBoundingClientRect(), ...data });
    },
    [],
  );

  const keepTip = useCallback((_key: string) => {
    if (tipTimeout.current) clearTimeout(tipTimeout.current);
  }, []);

  const scheduleTipClose = useCallback(() => {
    tipTimeout.current = setTimeout(() => setHeatmapTip(null), 100);
  }, []);

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

  const acwrDialogRows = useMemo(() => {
    return acwrCohort
      .map((row) => ({ ...row, priority: getSnapshotPriority(row) }))
      .filter((row) => row.priority === "alert" || row.priority === "warning")
      .sort((a, b) => {
        const w = (s: string) => (s === "alert" ? 2 : 1);
        return w(b.priority) - w(a.priority) || a.athlete.localeCompare(b.athlete, "fr");
      });
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
        <Link to="/athletes" className="block">
        <Card
          className="cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
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
        </Link>

        <Link to={`/activities?from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`} className="block">
        <Card
          className="cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
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
        </Link>

        <Link to="/health?swc=alert" className="block">
        <Card
          className="cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
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
        </Link>

        <Card
          className="cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          role="button"
          tabIndex={0}
          onClick={() => setShowAcwrDialog(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowAcwrDialog(true); } }}
        >
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
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-1.5 rounded-lg">
                <Icon name="warning_amber" className="text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Storage Gauge (auto-hide < 50%) ── */}
      <StorageGauge />

      {/* ── 2×2 Grid — Monitoring + Feed ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Heatmap MLS */}
        <Card className="xl:h-[420px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Icon name="monitoring" className="text-slate-400" />
              Charge MLS
            </h2>
            <div ref={groupDropdownRef} className="relative">
              <button
                onClick={() => setGroupDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {heatmapGroup ? (
                  <>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: groups.find((g) => g.id === heatmapGroup)?.color }} />
                    {groups.find((g) => g.id === heatmapGroup)?.name}
                  </>
                ) : (
                  "Tous les groupes"
                )}
                <Icon name="expand_more" className={`text-sm text-slate-400 transition-transform duration-200 ${groupDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {groupDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => { setHeatmapGroup(null); setGroupDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      heatmapGroup === null
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {heatmapGroup === null && <Icon name="check" className="text-sm" />}
                    <span className={heatmapGroup === null ? "" : "ml-5"}>Tous les groupes</span>
                  </button>
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { setHeatmapGroup(g.id); setGroupDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                        heatmapGroup === g.id
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {heatmapGroup === g.id && <Icon name="check" className="text-sm" />}
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                      <span className={heatmapGroup === g.id ? "" : ""}>{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
                      <div
                        key={athlete}
                        className="flex items-center gap-4 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150"
                      >
                        {athleteMatch ? (
                          <Link to={`/athletes/${athleteMatch.id}/trends`} className="w-28 flex items-center gap-2 shrink-0 cursor-pointer">
                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-medium border border-slate-200 dark:border-slate-700">
                              {athlete.charAt(0)}
                            </div>
                            <span className="text-xs font-medium truncate">{athlete}</span>
                          </Link>
                        ) : (
                          <div className="w-28 flex items-center gap-2 shrink-0">
                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-[9px] font-medium border border-slate-200 dark:border-slate-700">
                              {athlete.charAt(0)}
                            </div>
                            <span className="text-xs font-medium truncate">{athlete}</span>
                          </div>
                        )}
                        <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, minmax(0, 1fr))` }}>
                          {heatmapData.weeks.map((week) => {
                            const cell = heatmapData.getCell(athlete, week);
                            const mls = cell?.mls ?? 0;
                            const level = MLS_LEVEL(mls, thresholds);
                            const weekLabel = new Date(week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                            const cellKey = `${athlete}-${week}`;
                            const cellHref = athleteMatch
                              ? `/athletes/${athleteMatch.id}/bilan?period=week&date=${week}`
                              : undefined;
                            return cellHref ? (
                              <Link
                                key={week}
                                to={cellHref}
                                onMouseEnter={(e) => {
                                  if (cell && mls > 0) {
                                    openTip(cellKey, e.currentTarget, {
                                      mls,
                                      heures: cell.heures ?? null,
                                      nb_seances: cell.nb_seances ?? null,
                                      mls_intv: cell.mls_moyen_intervalles ?? null,
                                      weekLabel,
                                      levelBg: level.bg,
                                      levelLabel: level.label,
                                    });
                                  }
                                }}
                                onMouseLeave={scheduleTipClose}
                                className="relative block h-5 rounded-[3px] cursor-pointer hover:scale-y-[1.3] hover:z-10 hover:shadow-sm transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1"
                                style={{ backgroundColor: level.bg }}
                              />
                            ) : (
                              <div
                                key={week}
                                onMouseEnter={(e) => {
                                  if (cell && mls > 0) {
                                    openTip(cellKey, e.currentTarget, {
                                      mls,
                                      heures: cell.heures ?? null,
                                      nb_seances: cell.nb_seances ?? null,
                                      mls_intv: cell.mls_moyen_intervalles ?? null,
                                      weekLabel,
                                      levelBg: level.bg,
                                      levelLabel: level.label,
                                    });
                                  }
                                }}
                                onMouseLeave={scheduleTipClose}
                                className="relative h-5 rounded-[3px] transition-all duration-150 ease-out"
                                style={{ backgroundColor: level.bg }}
                              />
                            );
                          })}
                        </div>
                      </div>
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
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-150 cursor-pointer"
                    >
                      <td className="whitespace-nowrap">
                        <Link to={`/athletes/${row.athlete_id}/bilan`} className="flex items-center gap-2 px-2 py-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                            {row.athlete.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">
                            {row.athlete}
                          </span>
                        </Link>
                      </td>
                      {(["external", "internal", "global"] as const).map((metric) => (
                        <td
                          key={metric}
                          className="whitespace-nowrap"
                          title={formatAcwrTooltip(row, metric)}
                        >
                          <Link to={`/athletes/${row.athlete_id}/bilan`} className="flex items-center gap-1.5 px-2 py-2">
                            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white min-w-[2rem]">
                              {row[metric].ratio !== null
                                ? row[metric].ratio.toFixed(2)
                                : "—"}
                            </span>
                            <AcwrStatusBadge status={row[metric].status} />
                          </Link>
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
                        ? "px-2 py-0.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        : "px-2 py-0.5 text-[11px] font-medium rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-all duration-150"
                    }
                  >
                    {tab}
                  </button>
                );
              })}
              <select
                value={recentWorkType}
                onChange={(e) => setRecentWorkType(e.target.value)}
                className="ml-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
                  const sportCfg = getSportConfig(act.sport_type ?? "");
                  const averageHr = act.avg_hr != null ? `${Math.round(act.avg_hr)} bpm` : null;
                  const duration = (act as { moving_time_sec?: number | null }).moving_time_sec
                    ? formatDuration((act as { moving_time_sec: number }).moving_time_sec)
                    : act.duration_sec ? formatDuration(act.duration_sec) : "—";

                  return (
                    <Link
                      key={act.id}
                      to={`/activities/${act.id}`}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-left"
                      data-testid={`recent-activity-${act.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon name={sportCfg.icon} className={sportCfg.textColor} />
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
                    </Link>
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
                    <Link
                      key={alert.athlete_id}
                      to={`/athletes/${alert.athlete_id}/trends`}
                      className="w-full block text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-lg transition-all duration-150 hover:bg-primary/5 dark:hover:bg-primary/10"
                      aria-label={`Ouvrir le rapport détaillé de ${alert.athlete}`}
                      data-testid={`health-alert-${alert.athlete_id}`}
                    >
                      <div className="p-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-400 shrink-0">
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
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ACWR recap dialog ── */}
      <Dialog open={showAcwrDialog} onClose={() => setShowAcwrDialog(false)}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded-full">
              <Icon name="warning_amber" className="text-base" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">ACWR Alertes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {acwrSummary.alertCount} alerte{acwrSummary.alertCount > 1 ? "s" : ""} · {acwrSummary.warningCount} vigilance
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAcwrDialog(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </DialogHeader>
        <DialogBody className="p-0">
          {acwrDialogRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucune alerte ou vigilance active.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Athlete</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Ext.</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Int.</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Glob.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {acwrDialogRows.map((row) => (
                  <tr
                    key={row.athlete_id}
                    className="cursor-pointer transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap">
                      <Link to={`/athletes/${row.athlete_id}/bilan`} onClick={() => setShowAcwrDialog(false)} className="flex items-center gap-2.5 px-5 py-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                          {row.athlete.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[160px]">
                          {row.athlete}
                        </span>
                      </Link>
                    </td>
                    {(["external", "internal", "global"] as const).map((metric) => (
                      <td key={metric}>
                        <Link to={`/athletes/${row.athlete_id}/bilan`} onClick={() => setShowAcwrDialog(false)} className="flex items-center justify-center gap-1.5 px-3 py-3">
                          <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {row[metric].ratio !== null ? row[metric].ratio.toFixed(2) : "—"}
                          </span>
                          <AcwrStatusBadge status={row[metric].status} />
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogBody>
      </Dialog>

      {/* Portal tooltip for MLS heatmap — rendered outside overflow:hidden */}
      {heatmapTip &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-auto"
            style={{
              left: Math.min(
                Math.max(8, heatmapTip.rect.left + heatmapTip.rect.width / 2 - 68),
                window.innerWidth - 144,
              ),
              top: heatmapTip.rect.top - 6,
              transform: "translateY(-100%)",
            }}
            onMouseEnter={() => keepTip(heatmapTip.key)}
            onMouseLeave={scheduleTipClose}
          >
            <div className="rounded-md bg-slate-900 dark:bg-slate-750 shadow-sm shadow-black/25 ring-1 ring-white/[.08] px-2 py-1.5 text-[10px] leading-[14px] text-slate-200 tabular-nums whitespace-nowrap select-none">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: heatmapTip.levelBg }} />
                <span className="text-slate-400 uppercase tracking-wider font-medium">
                  {heatmapTip.weekLabel}
                </span>
                <span className="text-slate-500 mx-0.5">·</span>
                <span className="text-slate-400">{heatmapTip.levelLabel}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[13px] font-semibold text-white leading-none">
                  {Math.round(heatmapTip.mls).toLocaleString("fr-FR")}
                </span>
                <span className="text-slate-500 text-[9px]">MLS</span>
                {heatmapTip.heures != null && (
                  <>
                    <span className="text-slate-600 mx-px">·</span>
                    <span className="text-slate-400">{heatmapTip.heures.toFixed(1)}h</span>
                  </>
                )}
                {heatmapTip.nb_seances != null && (
                  <>
                    <span className="text-slate-600 mx-px">·</span>
                    <span className="text-slate-400">{heatmapTip.nb_seances}s</span>
                  </>
                )}
                {heatmapTip.mls_intv != null && (
                  <>
                    <span className="text-slate-600 mx-px">·</span>
                    <span className="text-slate-400">moy {Math.round(heatmapTip.mls_intv).toLocaleString("fr-FR")}</span>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
