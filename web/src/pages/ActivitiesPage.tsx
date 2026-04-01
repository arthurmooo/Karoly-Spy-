import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SessionFilters } from "@/components/filters/SessionFilters";
import { SortableHeader } from "@/components/tables/SortableHeader";
import { getSportConfig } from "@/lib/constants";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { AthleteAvatar } from "@/components/ui/AthleteAvatar";
import { useAvatarMap } from "@/hooks/useAvatarMap";
import { useActivities } from "@/hooks/useActivities";
import { useAthletes } from "@/hooks/useAthletes";
import { buildActivityLinkState } from "@/lib/activityNavigation";

const DEFAULT_SORT_BY = "session_date";
const DEFAULT_SORT_DIR: SortDirection = "desc";

export function ActivitiesPage() {
  const location = useLocation();
  const {
    activities,
    total,
    page,
    perPage,
    isLoading,
    athleteId,
    sportType,
    workType,
    durationRange,
    dateFrom,
    dateTo,
    search,
    hasActiveFilters,
    resetAll,
    refresh,
    setPage,
    setAthlete,
    setSport,
    setWorkType,
    setDuration,
    setDateFrom,
    setDateTo,
    setSearch,
    sortBy,
    sortDir,
    setSort,
  } = useActivities();
  const { athletes } = useAthletes();
  const { getAvatarUrl } = useAvatarMap();

  // Refetch when navigating back to this page (e.g. after editing work_type)
  useEffect(() => { refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : page * perPage + 1;
  const rangeEnd = Math.min((page + 1) * perPage, total);

  type ActivitiesSortColumn =
    | "session_date"
    | "athlete_name"
    | "sport_type"
    | "work_type"
    | "duration_sec"
    | "distance_m"
    | "load_index"
    | "rpe"
    | "avg_hr"
    | "pace_or_power";

  const handleSort = (column: ActivitiesSortColumn) => {
    if (sortBy !== column) {
      setSort(column, column === "session_date" ? "desc" : "asc");
      return;
    }
    if (sortDir === "asc") {
      setSort(column, "desc");
      return;
    }
    setSort(DEFAULT_SORT_BY, DEFAULT_SORT_DIR);
  };

  const displayActivities =
    sortBy === "pace_or_power"
      ? sortRows(activities, (activity) => activity.pace_sort_value, sortDir)
      : activities;
  const detailState = buildActivityLinkState(location);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Journal d'Activités
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {total} activité{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <SessionFilters
        sportType={sportType}
        workType={workType}
        durationRange={durationRange}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
        onSportChange={setSport}
        onWorkTypeChange={setWorkType}
        onDurationChange={setDuration}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSearchChange={setSearch}
        onReset={resetAll}
        hasActiveFilters={hasActiveFilters}
        athleteId={athleteId}
        athletes={athletes}
        onAthleteChange={setAthlete}
      />

      {/* Desktop Table */}
      <Card className="overflow-hidden rounded-xl border-slate-200/60 dark:border-slate-800/60 hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800/60">
                <SortableHeader label="Date" active={sortBy === "session_date"} direction={sortDir} onToggle={() => handleSort("session_date")} />
                <SortableHeader label="Athlète" active={sortBy === "athlete_name"} direction={sortDir} onToggle={() => handleSort("athlete_name")} />
                <SortableHeader label="Sport" active={sortBy === "sport_type"} direction={sortDir} onToggle={() => handleSort("sport_type")} />
                <SortableHeader label="Type" active={sortBy === "work_type"} direction={sortDir} onToggle={() => handleSort("work_type")} />
                <SortableHeader label="Durée" active={sortBy === "duration_sec"} direction={sortDir} onToggle={() => handleSort("duration_sec")} />
                <SortableHeader label="Distance" active={sortBy === "distance_m"} direction={sortDir} onToggle={() => handleSort("distance_m")} />
                <SortableHeader label="MLS" active={sortBy === "load_index"} direction={sortDir} onToggle={() => handleSort("load_index")} />
                <SortableHeader label="RPE" active={sortBy === "rpe"} direction={sortDir} onToggle={() => handleSort("rpe")} />
                <SortableHeader label="FC Moy" active={sortBy === "avg_hr"} direction={sortDir} onToggle={() => handleSort("avg_hr")} />
                <SortableHeader label="Allure / Puissance" active={sortBy === "pace_or_power"} direction={sortDir} onToggle={() => handleSort("pace_or_power")} />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="progress_activity" className="text-3xl text-primary animate-spin" />
                      <span className="text-sm text-slate-500">Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="inbox" className="text-4xl text-slate-300 dark:text-slate-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Aucune activité trouvée</p>
                        {hasActiveFilters && (
                          <p className="text-xs text-slate-400 mt-1">Essayez de modifier vos filtres</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                displayActivities.map((act) => {
                  const cfg = getSportConfig(act.sport);
                  const detailHref = `/activities/${act.id}`;
                  const rowLinkClassName = "block -mx-4 -my-3.5 px-4 py-3.5 transition-all duration-150";

                  return (
                    <tr
                      key={act.id}
                      className="cursor-pointer border-b border-slate-100/70 dark:border-slate-800/40 last:border-0 transition-all duration-150 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {format(new Date(act.date), "dd MMM yyyy", { locale: fr })}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <div className="flex items-start gap-2">
                            <AthleteAvatar name={act.athlete} avatarUrl={getAvatarUrl(act.athlete)} size="sm" />
                            <div className="min-w-0">
                              <div className="whitespace-nowrap">{act.athlete}</div>
                              <div className="max-w-[130px] truncate text-xs text-slate-500 dark:text-slate-400">
                                {act.title}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <div className="flex items-center gap-2">
                            <Icon name={cfg.icon} className={cfg.textColor} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{act.sport}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <Badge
                            variant={
                              act.work_type === "Compétition" ? "orange" : act.work_type === "Endurance" ? "primary" : "slate"
                            }
                          >
                            {act.work_type}
                          </Badge>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.duration}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.distance}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.mls != null ? (
                            <Badge variant={act.mls > 7 ? "red" : act.mls > 5 ? "orange" : act.mls > 3 ? "amber" : "emerald"}>
                              {act.mls.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">--</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.rpe != null && act.rpe >= 1 ? (
                            <Badge variant={act.rpe >= 9 ? "red" : act.rpe >= 7 ? "orange" : act.rpe >= 4 ? "amber" : "emerald"}>
                              {act.rpe}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">--</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.hr}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.pace}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Desktop Pagination */}
        <div className="px-4 py-3 border-t border-slate-100/70 dark:border-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {total === 0
              ? "Aucune activité"
              : `${rangeStart}–${rangeEnd} sur ${total}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <Icon name="chevron_left" />
            </Button>
            <span className="text-xs font-medium text-slate-500 px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <Icon name="chevron_right" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-20">
            <Icon name="progress_activity" className="text-3xl text-primary animate-spin" />
            <span className="text-sm text-slate-500">Chargement...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Icon name="inbox" className="text-4xl text-slate-300 dark:text-slate-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">Aucune activité trouvée</p>
              {hasActiveFilters && (
                <p className="text-xs text-slate-400 mt-1">Essayez de modifier vos filtres</p>
              )}
            </div>
          </div>
        ) : (
          displayActivities.map((act) => {
            const cfg = getSportConfig(act.sport);
            const detailHref = `/activities/${act.id}`;

            return (
              <Link key={act.id} to={detailHref} state={detailState} className="block">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 active:scale-[0.98] transition-all">
                  {/* Row 1: Sport icon + Athlete + Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${cfg.bgLight} flex items-center justify-center`}>
                        <Icon name={cfg.icon} className={cfg.textColor} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{act.athlete}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{act.title}</div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">
                      {format(new Date(act.date), "dd MMM", { locale: fr })}
                    </span>
                  </div>
                  {/* Row 2: Metrics */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge
                      variant={
                        act.work_type === "Compétition" ? "orange" : act.work_type === "Endurance" ? "primary" : "slate"
                      }
                    >
                      {act.work_type}
                    </Badge>
                    <span className="text-xs font-mono text-slate-500">{act.duration}</span>
                    <span className="text-xs font-mono text-slate-500">{act.distance}</span>
                    {act.mls != null && (
                      <Badge variant={act.mls > 7 ? "red" : act.mls > 5 ? "orange" : act.mls > 3 ? "amber" : "emerald"}>
                        MLS {act.mls.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}

        {/* Mobile Pagination */}
        {!isLoading && activities.length > 0 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <Icon name="chevron_left" />
            </Button>
            <span className="text-xs font-medium text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <Icon name="chevron_right" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
