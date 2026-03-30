import { useEffect, useMemo, useRef, useState } from "react";
import { getStatsActivities, type StatsActivityRow } from "@/repositories/stats.repository";
import {
  buildAthleteKpiReport,
  getAthleteKpiFetchRange,
  type AthleteKpiReport,
  type KpiPeriod,
} from "@/services/stats.service";

export function useAthleteKpis(
  athleteId: string | null,
  period: KpiPeriod,
  anchorDate?: Date,
  sportFilter?: string
) {
  const [rawRows, setRawRows] = useState<StatsActivityRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  // Stable string key to avoid re-renders from Date object identity
  const anchorKey = anchorDate ? anchorDate.toISOString().slice(0, 10) : "today";

  useEffect(() => {
    if (!athleteId) {
      setRawRows(null);
      setIsLoading(false);
      hasLoadedOnce.current = false;
      return;
    }

    let cancelled = false;
    // Only show full loading state on first load; keep stale data on subsequent fetches
    if (!hasLoadedOnce.current) {
      setIsLoading(true);
    }

    const now = anchorDate ?? new Date();
    const range = getAthleteKpiFetchRange(period, now);

    getStatsActivities({
      athleteId,
      from: range.start,
      to: range.end,
    })
      .then((rows) => {
        if (cancelled) return;
        setRawRows(rows);
        hasLoadedOnce.current = true;
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setRawRows(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId, period, anchorKey]);

  const report = useMemo<AthleteKpiReport | null>(() => {
    if (!rawRows) return null;
    const now = anchorDate ?? new Date();
    return buildAthleteKpiReport(rawRows, period, now, sportFilter);
  }, [rawRows, period, anchorDate, sportFilter]);

  return { report, isLoading };
}
