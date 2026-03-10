import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getActivities } from "@/repositories/activity.repository";
import { formatActivityRow } from "@/services/activity.service";

const PER_PAGE = 25;

export function useActivities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activities, setActivities] = useState<ReturnType<typeof formatActivityRow>[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const page = parseInt(searchParams.get("page") ?? "0", 10);
  const athleteId = searchParams.get("athlete") ?? undefined;
  const sportType = searchParams.get("sport") ?? undefined;
  const dateFrom = searchParams.get("from") ?? undefined;
  const search = searchParams.get("q") ?? undefined;

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
    let cancelled = false;
    setIsLoading(true);

    getActivities({
      athlete_id: athleteId,
      sport_type: sportType,
      date_from: dateFrom,
      search,
      page,
      per_page: PER_PAGE,
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
  }, [page, athleteId, sportType, dateFrom, search]);

  return {
    activities,
    total,
    page,
    perPage: PER_PAGE,
    isLoading,
    setPage: (p: number) => updateParam("page", p > 0 ? String(p) : null),
    setAthlete: (id: string | null) => updateParam("athlete", id),
    setSport: (s: string | null) => updateParam("sport", s),
    setDateFrom: (d: string | null) => updateParam("from", d),
    setSearch: (q: string | null) => updateParam("q", q),
  };
}
