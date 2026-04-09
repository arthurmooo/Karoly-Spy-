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
import { useAthleteGroups } from "@/hooks/useAthleteGroups";
import { sortRows, type SortDirection } from "@/lib/tableSort";
import { useActivities } from "@/hooks/useActivities";
import { useMyAthleteProfile } from "@/hooks/useMyAthleteProfile";
import { buildActivityLinkState } from "@/lib/activityNavigation";

const DEFAULT_SORT_BY = "session_date";
const DEFAULT_SORT_DIR: SortDirection = "desc";

export function AthleteHomePage() {
  const location = useLocation();
  const { profile, isLoading: profileLoading } = useMyAthleteProfile();
  const { getGroupById } = useAthleteGroups();
  const {
    activities,
    total,
    page,
    perPage,
    isLoading,
    sportType,
    workType,
    durationRange,
    dateFrom,
    dateTo,
    search,
    hasActiveFilters,
    resetAll,
    setPage,
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

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : page * perPage + 1;
  const rangeEnd = Math.min((page + 1) * perPage, total);

  type SortColumn =
    | "session_date"
    | "sport_type"
    | "work_type"
    | "duration_sec"
    | "distance_m"
    | "load_index"
    | "rpe"
    | "avg_hr"
    | "pace_or_power";

  const handleSort = (column: SortColumn) => {
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
      ? sortRows(activities, (a) => a.pace_sort_value, sortDir)
      : activities;

  const rowLinkClassName = "block -mx-4 -my-3 px-4 py-3 transition-all duration-150";
  const detailState = buildActivityLinkState(location);

  const athleteName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : null;
  const athleteGroup = profile?.athlete_group_id
    ? getGroupById(profile.athlete_group_id)
    : undefined;
  const groupLabel = athleteGroup?.name ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-3">
            {profileLoading ? "Mon espace" : athleteName ? `${athleteName}` : "Mon espace"}
            {groupLabel && athleteGroup && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: athleteGroup.color }}
              >
                {groupLabel}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Historique de vos séances d'entraînement.</p>
        </div>
      </div>

      {/* Filters — no athlete select (RLS scopes automatically) */}
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
      />

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <SortableHeader label="Date" active={sortBy === "session_date"} direction={sortDir} onToggle={() => handleSort("session_date")} />
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="progress_activity" className="text-3xl text-primary animate-spin" />
                      <span className="text-sm text-slate-500">Chargement des activités...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <span className="text-sm text-slate-500">Aucune activité trouvée.</span>
                  </td>
                </tr>
              ) : (
                displayActivities.map((act) => {
                  const sportCfg = getSportConfig(act.sport);
                  const detailHref = `/mon-espace/activities/${act.id}`;

                  return (
                    <tr
                      key={act.id}
                      className="cursor-pointer transition-all duration-150 hover:bg-primary/5 dark:hover:bg-primary/10"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <div className="whitespace-nowrap">{format(new Date(act.date), "dd MMM yyyy", { locale: fr })}</div>
                          {act.title && act.title !== "Séance" && (
                            <div className="max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                              {act.title}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <div className="flex items-center gap-2">
                            <Icon name={sportCfg.icon} className={sportCfg.textColor} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{act.sport}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.duration}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.distance}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 whitespace-nowrap">
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
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          {act.hr}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-400">
                        <Link to={detailHref} state={detailState} className={rowLinkClassName}>
                          <div className="whitespace-nowrap">{act.pace}</div>
                          {act.paceSecondary && (
                            <div className="mt-0.5 whitespace-nowrap text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {act.paceSecondary}
                            </div>
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <span className="text-sm text-slate-500">
            {total === 0
              ? "Aucune activité"
              : `Affichage de ${rangeStart} à ${rangeEnd} sur ${total} activités`}
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
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-2">
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
    </div>
  );
}
