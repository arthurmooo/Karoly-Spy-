import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getActivities } from "@/repositories/activity.repository";
import { formatActivityRow } from "@/services/activity.service";
import { parseDurationRange } from "@/services/filter.service";
import type { SortDirection } from "@/lib/tableSort";

const PER_PAGE = 25;
const DEFAULT_SORT_BY = "session_date";
const DEFAULT_SORT_DIR: SortDirection = "desc";

export function useActivities() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activities, setActivities] = useState<ReturnType<typeof formatActivityRow>[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const page = parseInt(searchParams.get("page") ?? "0", 10);
  const athleteId = searchParams.get("athlete") ?? undefined;
  const sportType = searchParams.get("sport") ?? undefined;
  const workType = searchParams.get("type") ?? undefined;
  const durationRange = searchParams.get("duration") ?? undefined;
  const dateFrom = searchParams.get("from") ?? undefined;
  const dateTo = searchParams.get("to") ?? undefined;
  const search = searchParams.get("q") ?? undefined;
  const sortBy = searchParams.get("sort") ?? DEFAULT_SORT_BY;
  const sortDir = (searchParams.get("dir") as SortDirection | null) ?? DEFAULT_SORT_DIR;

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    setIsLoading(true);

    const { min: duration_min, max: duration_max } = parseDurationRange(durationRange ?? "");

    getActivities({
      athlete_id: athleteId,
      sport_type: sportType,
      work_type: workType,
      date_from: dateFrom,
      date_to: dateTo,
      search,
      duration_min,
      duration_max,
      page,
      per_page: PER_PAGE,
      sort_by: sortBy,
      sort_dir: sortDir,
    })
      .then(({ data, count }) => {
        if (cancelled) return;
        setActivities(data.map(formatActivityRow));
        setTotal(count);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, page, athleteId, sportType, workType, durationRange, dateFrom, dateTo, search, sortBy, sortDir, refreshKey]);

  const hasActiveFilters = !!(athleteId || sportType || workType || durationRange || dateFrom || dateTo || search);

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    activities,
    total,
    page,
    perPage: PER_PAGE,
    isLoading,
    athleteId: athleteId ?? "",
    sportType: sportType ?? "",
    workType: workType ?? "",
    durationRange: durationRange ?? "",
    dateFrom: dateFrom ?? "",
    dateTo: dateTo ?? "",
    search: search ?? "",
    hasActiveFilters,
    resetAll,
    refresh,
    setPage: (p: number) => updateParam("page", p > 0 ? String(p) : null),
    setAthlete: (id: string | null) => updateParam("athlete", id),
    setSport: (s: string | null) => updateParam("sport", s),
    setWorkType: (t: string | null) => updateParam("type", t),
    setDuration: (d: string | null) => updateParam("duration", d),
    setDateFrom: (d: string | null) => updateParam("from", d),
    setDateTo: (d: string | null) => updateParam("to", d),
    setSearch: (q: string | null) => updateParam("q", q),
    sortBy,
    sortDir,
    setSort: (column: string, direction: SortDirection) => {
      const next = new URLSearchParams(searchParams);
      next.set("sort", column);
      next.set("dir", direction);
      next.delete("page");
      setSearchParams(next);
    },
  };
}
