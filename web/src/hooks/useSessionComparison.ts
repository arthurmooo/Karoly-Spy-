import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchActivityStreams,
  getActivityDetail,
  getComparableActivities,
} from "@/repositories/activity.repository";
import {
  buildComparisonChartModel,
  buildComparisonSummary,
  isComparisonSportSupported,
} from "@/services/sessionComparison.service";
import type {
  Activity,
  ActivityComparisonCandidate,
  ComparisonSummary,
} from "@/types/activity";
import type { SessionComparisonChartModel } from "@/services/sessionComparison.service";

function hasRequiredStreamMappings(activity: Activity | null | undefined) {
  return (
    activity?.activity_streams?.some(
      (point) =>
        typeof point.elapsed_t === "number" &&
        Number.isFinite(point.elapsed_t) &&
        typeof point.dist_m === "number" &&
        Number.isFinite(point.dist_m)
    ) ?? false
  );
}

interface UseSessionComparisonResult {
  candidates: ActivityComparisonCandidate[];
  selectedActivity: Activity | null;
  selectedId: string;
  setSelectedId: (id: string) => void;
  isLoadingCandidates: boolean;
  isLoadingSelected: boolean;
  isSupportedSport: boolean;
  hasComparableDistance: boolean;
  summary: ComparisonSummary | null;
  chartModel: SessionComparisonChartModel | null;
}

export function useSessionComparison(
  baseActivity: Activity | null,
  open: boolean
): UseSessionComparisonResult {
  const [candidates, setCandidates] = useState<ActivityComparisonCandidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);
  const cacheRef = useRef<Record<string, Activity>>({});

  const isSupportedSport = isComparisonSportSupported(baseActivity?.sport_type);
  const hasComparableDistance = (baseActivity?.distance_m ?? 0) > 0;

  useEffect(() => {
    if (!open || !baseActivity) return;

    if (!isSupportedSport || !hasComparableDistance) {
      setCandidates([]);
      setSelectedId("");
      setSelectedActivity(null);
      return;
    }

    let cancelled = false;
    setIsLoadingCandidates(true);

    getComparableActivities(baseActivity)
      .then((nextCandidates) => {
        if (cancelled) return;
        setCandidates(nextCandidates);
        setSelectedId((prev) => {
          if (prev && nextCandidates.some((candidate) => candidate.id === prev)) return prev;
          return nextCandidates[0]?.id ?? "";
        });
        if (nextCandidates.length === 0) {
          setSelectedActivity(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Comparable activities fetch error:", error);
          setCandidates([]);
          setSelectedId("");
          setSelectedActivity(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCandidates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseActivity, hasComparableDistance, isSupportedSport, open]);

  useEffect(() => {
    if (!open || !selectedId) {
      setSelectedActivity(null);
      return;
    }

    const cached = cacheRef.current[selectedId];
    if (cached) {
      setSelectedActivity(cached);
      return;
    }

    let cancelled = false;
    setIsLoadingSelected(true);

    getActivityDetail(selectedId)
      .then(async ({ activity }) => {
        let merged = activity as unknown as Activity;

        if (merged.fit_file_path && !hasRequiredStreamMappings(merged)) {
          try {
            const streamResult = await fetchActivityStreams(selectedId);
            merged = {
              ...merged,
              activity_streams: streamResult.streams ?? merged.activity_streams,
              garmin_laps: streamResult.laps ?? merged.garmin_laps,
            };
          } catch (error) {
            console.error("Reference stream fetch error:", error);
          }
        }

        if (cancelled) return;
        cacheRef.current[selectedId] = merged;
        setSelectedActivity(merged);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Reference activity fetch error:", error);
          setSelectedActivity(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSelected(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  const summary = useMemo<ComparisonSummary | null>(() => {
    if (!baseActivity || !selectedActivity) return null;
    return buildComparisonSummary(baseActivity, selectedActivity);
  }, [baseActivity, selectedActivity]);

  const chartModel = useMemo<SessionComparisonChartModel | null>(() => {
    if (!baseActivity || !selectedActivity) return null;
    return buildComparisonChartModel(baseActivity, selectedActivity);
  }, [baseActivity, selectedActivity]);

  return {
    candidates,
    selectedActivity,
    selectedId,
    setSelectedId,
    isLoadingCandidates,
    isLoadingSelected,
    isSupportedSport,
    hasComparableDistance,
    summary,
    chartModel,
  };
}
