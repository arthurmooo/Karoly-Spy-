import { useState, useEffect } from "react";
import { getHealthRadar, getReadinessSeries } from "@/repositories/readiness.repository";
import type { HealthRadarRow, DailyReadiness } from "@/types/readiness";

export function useReadiness(athleteId?: string) {
  const [healthData, setHealthData] = useState<HealthRadarRow[]>([]);
  const [readinessSeries, setReadinessSeries] = useState<DailyReadiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const promises: Promise<void>[] = [];

    promises.push(
      getHealthRadar()
        .then(setHealthData)
        .catch(console.error)
    );

    if (athleteId) {
      promises.push(
        getReadinessSeries(athleteId, 30)
          .then(setReadinessSeries)
          .catch(console.error)
      );
    }

    Promise.all(promises).finally(() => setIsLoading(false));
  }, [athleteId]);

  return { healthData, readinessSeries, isLoading };
}
