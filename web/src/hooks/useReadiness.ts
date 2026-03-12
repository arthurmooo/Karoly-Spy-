import { useState, useEffect } from "react";
import { getHealthRadar, getReadinessSeries } from "@/repositories/readiness.repository";
import type { HealthRadarRow, DailyReadiness } from "@/types/readiness";

export function useReadiness(athleteId?: string, seriesDays = 30) {
  const [healthData, setHealthData] = useState<HealthRadarRow[]>([]);
  const [readinessSeries, setReadinessSeries] = useState<DailyReadiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

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
        getReadinessSeries(athleteId, seriesDays)
          .then(setReadinessSeries)
          .catch(console.error)
      );
    }

    Promise.all(promises).finally(() => setIsLoading(false));
  }, [athleteId, refreshToken, seriesDays]);

  return {
    healthData,
    readinessSeries,
    isLoading,
    refresh: async () => {
      setRefreshToken((token) => token + 1);
    },
  };
}
