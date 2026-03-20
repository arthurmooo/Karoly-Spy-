import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getWeeklyMonitoring } from "@/repositories/load.repository";
import { buildHeatmapData } from "@/services/load.service";

export function useLoad(weeks = 12) {
  const { user, loading: authLoading } = useAuth();
  const [heatmapData, setHeatmapData] = useState<ReturnType<typeof buildHeatmapData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    setIsLoading(true);
    getWeeklyMonitoring(weeks)
      .then((rows) => setHeatmapData(buildHeatmapData(rows)))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [authLoading, user?.id, weeks]);

  return { heatmapData, isLoading };
}
