import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAcwrMonitoringRows } from "@/repositories/load.repository";
import { buildAthleteAcwrDetail, buildAcwrSnapshotRows } from "@/services/load.service";
import type { AthleteAcwrDetail, AcwrSnapshotRow } from "@/types/acwr";

interface UseAcwrOptions {
  athleteId?: string | null;
  enabled?: boolean;
}

export function useAcwr({ athleteId = null, enabled = true }: UseAcwrOptions = {}) {
  const { user, loading: authLoading } = useAuth();
  const [cohort, setCohort] = useState<AcwrSnapshotRow[]>([]);
  const [detail, setDetail] = useState<AthleteAcwrDetail | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!enabled) {
      setCohort([]);
      setDetail(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const request = athleteId
      ? getAcwrMonitoringRows(athleteId).then((rows) => {
          setDetail(buildAthleteAcwrDetail(rows, athleteId));
          setCohort([]);
        })
      : getAcwrMonitoringRows().then((rows) => {
          setCohort(buildAcwrSnapshotRows(rows));
          setDetail(null);
        });

    request
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [authLoading, user?.id, athleteId, enabled]);

  return { cohort, detail, isLoading };
}
