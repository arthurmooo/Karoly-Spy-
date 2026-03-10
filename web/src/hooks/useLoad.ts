import { useState, useEffect } from "react";
import { getWeeklyMonitoring } from "@/repositories/load.repository";
import { buildHeatmapData } from "@/services/load.service";

export function useLoad(weeks = 12) {
  const [heatmapData, setHeatmapData] = useState<ReturnType<typeof buildHeatmapData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getWeeklyMonitoring(weeks)
      .then((rows) => setHeatmapData(buildHeatmapData(rows)))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [weeks]);

  return { heatmapData, isLoading };
}
