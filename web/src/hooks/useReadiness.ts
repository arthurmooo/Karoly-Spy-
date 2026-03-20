import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getHealthRadar, getReadinessSeries } from "@/repositories/readiness.repository";
import type { HealthRadarRow, DailyReadiness } from "@/types/readiness";

export function useReadiness(athleteId?: string, seriesDays = 30) {
  const { user, loading: authLoading } = useAuth();
  const [healthData, setHealthData] = useState<HealthRadarRow[]>([]);
  const [readinessSeries, setReadinessSeries] = useState<DailyReadiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;

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
  }, [authLoading, user?.id, athleteId, refreshToken, seriesDays]);

  return {
    healthData,
    readinessSeries,
    isLoading,
    refresh: async () => {
      setRefreshToken((token) => token + 1);
    },
  };
}
