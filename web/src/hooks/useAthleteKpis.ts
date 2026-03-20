import { useEffect, useState } from "react";
import { getStatsActivities } from "@/repositories/stats.repository";
import {
  buildAthleteKpiReport,
  getAthleteKpiFetchRange,
  type AthleteKpiReport,
  type KpiPeriod,
} from "@/services/stats.service";

export function useAthleteKpis(athleteId: string | null, period: KpiPeriod) {
  const [report, setReport] = useState<AthleteKpiReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) {
      setReport(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const now = new Date();
    const range = getAthleteKpiFetchRange(period, now);

    getStatsActivities({
      athleteId,
      from: range.start,
      to: range.end,
    })
      .then((rows) => {
        if (cancelled) return;
        setReport(buildAthleteKpiReport(rows, period, now));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId, period]);

  return { report, isLoading };
}
