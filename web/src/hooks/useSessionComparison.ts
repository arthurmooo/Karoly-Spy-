import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchActivityStreams,
  getActivityDetail,
  getComparableActivities,
  getSportActivitiesForComparison,
} from "@/repositories/activity.repository";
import {
  buildComparisonChartModel,
  buildComparisonSummary,
  isComparisonSportSupported,
} from "@/services/sessionComparison.service";
import { parseDurationRange } from "@/services/filter.service";
import type {
  Activity,
  ActivityComparisonCandidate,
  ComparisonRangeSelection,
  ComparisonSummary,
} from "@/types/activity";
import type { SessionComparisonChartModel } from "@/services/sessionComparison.service";

const MIN_RANGE_KM = 0.1;

export type SessionComparisonSelectionMode = "recommended" | "library";

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

function getComparableDistanceKm(activity: Activity | null | undefined): number {
  if (activity?.activity_streams?.length) {
    const distances = activity.activity_streams
      .map((point) => point.dist_m)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (distances.length > 1) {
      return Math.max(0, (Math.max(...distances) - Math.min(...distances)) / 1000);
    }
  }

  return Math.max(0, (activity?.distance_m ?? 0) / 1000);
}

function roundKm(value: number): number {
  return Math.round(value * 100) / 100;
}

function createFullRange(maxDistanceKm: number): ComparisonRangeSelection {
  return {
    startKm: 0,
    endKm: roundKm(Math.max(0, maxDistanceKm)),
  };
}

function clampRange(
  range: ComparisonRangeSelection,
  maxDistanceKm: number
): ComparisonRangeSelection {
  const cappedMax = roundKm(Math.max(0, maxDistanceKm));
  if (cappedMax <= 0) return { startKm: 0, endKm: 0 };

  let startKm = Number.isFinite(range.startKm) ? range.startKm : 0;
  let endKm = Number.isFinite(range.endKm) ? range.endKm : cappedMax;

  startKm = Math.min(Math.max(0, startKm), cappedMax);
  endKm = Math.min(Math.max(0, endKm), cappedMax);

  if (endKm < startKm) {
    [startKm, endKm] = [endKm, startKm];
  }

  if (endKm - startKm < Math.min(MIN_RANGE_KM, cappedMax)) {
    endKm = Math.min(cappedMax, startKm + MIN_RANGE_KM);
    if (endKm - startKm < Math.min(MIN_RANGE_KM, cappedMax)) {
      startKm = Math.max(0, endKm - MIN_RANGE_KM);
    }
  }

  return {
    startKm: roundKm(startKm),
    endKm: roundKm(endKm),
  };
}

interface UseSessionComparisonResult {
  candidates: ActivityComparisonCandidate[];
  recommendedCandidates: ActivityComparisonCandidate[];
  libraryCandidates: ActivityComparisonCandidate[];
  selectedActivity: Activity | null;
  selectedId: string;
  setSelectedId: (id: string) => void;
  selectionMode: SessionComparisonSelectionMode;
  setSelectionMode: (mode: SessionComparisonSelectionMode) => void;
  isLoadingCandidates: boolean;
  isLoadingLibrary: boolean;
  isLoadingSelected: boolean;
  isSupportedSport: boolean;
  hasComparableDistance: boolean;
  summary: ComparisonSummary | null;
  chartModel: SessionComparisonChartModel | null;
  librarySearch: string;
  setLibrarySearch: (value: string) => void;
  libraryWorkType: string;
  setLibraryWorkType: (value: string) => void;
  libraryDurationRange: string;
  setLibraryDurationRange: (value: string) => void;
  libraryDateFrom: string;
  setLibraryDateFrom: (value: string) => void;
  libraryDateTo: string;
  setLibraryDateTo: (value: string) => void;
  hasActiveLibraryFilters: boolean;
  resetLibraryFilters: () => void;
  baseRange: ComparisonRangeSelection;
  referenceRange: ComparisonRangeSelection;
  setBaseRange: (range: ComparisonRangeSelection) => void;
  setReferenceRange: (range: ComparisonRangeSelection) => void;
  baseMaxDistanceKm: number;
  referenceMaxDistanceKm: number;
  canEditBaseRange: boolean;
  canEditReferenceRange: boolean;
}

export function useSessionComparison(
  baseActivity: Activity | null,
  open: boolean
): UseSessionComparisonResult {
  const [recommendedCandidates, setRecommendedCandidates] = useState<ActivityComparisonCandidate[]>([]);
  const [libraryCandidates, setLibraryCandidates] = useState<ActivityComparisonCandidate[]>([]);
  const [selectionMode, setSelectionMode] = useState<SessionComparisonSelectionMode>("recommended");
  const [selectedId, setSelectedId] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryWorkType, setLibraryWorkType] = useState("");
  const [libraryDurationRange, setLibraryDurationRange] = useState("");
  const [libraryDateFrom, setLibraryDateFrom] = useState("");
  const [libraryDateTo, setLibraryDateTo] = useState("");
  const [baseRange, setBaseRangeState] = useState<ComparisonRangeSelection>({ startKm: 0, endKm: 0 });
  const [referenceRange, setReferenceRangeState] = useState<ComparisonRangeSelection>({ startKm: 0, endKm: 0 });
  const cacheRef = useRef<Record<string, Activity>>({});
  const previousBaseMaxRef = useRef(0);
  const previousReferenceMaxRef = useRef(0);

  const isSupportedSport = isComparisonSportSupported(baseActivity?.sport_type);
  const hasComparableDistance = (baseActivity?.distance_m ?? 0) > 0;
  const baseMaxDistanceKm = useMemo(() => getComparableDistanceKm(baseActivity), [baseActivity]);
  const referenceMaxDistanceKm = useMemo(() => getComparableDistanceKm(selectedActivity), [selectedActivity]);
  const canEditBaseRange = hasRequiredStreamMappings(baseActivity) && baseMaxDistanceKm > 0;
  const canEditReferenceRange = hasRequiredStreamMappings(selectedActivity) && referenceMaxDistanceKm > 0;
  const hasActiveLibraryFilters = Boolean(
    librarySearch || libraryWorkType || libraryDurationRange || libraryDateFrom || libraryDateTo
  );

  useEffect(() => {
    setSelectionMode("recommended");
    setSelectedId("");
    setSelectedActivity(null);
    setRecommendedCandidates([]);
    setLibraryCandidates([]);
    setLibrarySearch("");
    setLibraryWorkType("");
    setLibraryDurationRange("");
    setLibraryDateFrom("");
    setLibraryDateTo("");
    cacheRef.current = {};
  }, [baseActivity?.id]);

  useEffect(() => {
    const nextRange = createFullRange(baseMaxDistanceKm);
    previousBaseMaxRef.current = baseMaxDistanceKm;
    setBaseRangeState(nextRange);
  }, [baseActivity?.id, baseMaxDistanceKm]);

  useEffect(() => {
    if (!selectedActivity?.id) {
      previousReferenceMaxRef.current = 0;
      setReferenceRangeState({ startKm: 0, endKm: 0 });
      return;
    }

    const nextRange = createFullRange(referenceMaxDistanceKm);
    previousReferenceMaxRef.current = referenceMaxDistanceKm;
    setReferenceRangeState(nextRange);
  }, [selectedActivity?.id, referenceMaxDistanceKm]);

  useEffect(() => {
    if (!open || !baseActivity) return;

    if (!isSupportedSport || !hasComparableDistance) {
      setRecommendedCandidates([]);
      setLibraryCandidates([]);
      setSelectedId("");
      setSelectedActivity(null);
      return;
    }

    let cancelled = false;
    setIsLoadingCandidates(true);

    getComparableActivities(baseActivity)
      .then((nextCandidates) => {
        if (cancelled) return;
        setRecommendedCandidates(nextCandidates);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Comparable activities fetch error:", error);
          setRecommendedCandidates([]);
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
    if (!open || !baseActivity) return;

    if (!isSupportedSport || selectionMode !== "library") {
      if (selectionMode !== "library") {
        setIsLoadingLibrary(false);
      }
      return;
    }

    let cancelled = false;
    const { min: duration_min, max: duration_max } = parseDurationRange(libraryDurationRange);
    setIsLoadingLibrary(true);

    getSportActivitiesForComparison(baseActivity, {
      work_type: libraryWorkType || undefined,
      date_from: libraryDateFrom || undefined,
      date_to: libraryDateTo || undefined,
      search: librarySearch || undefined,
      duration_min,
      duration_max,
    })
      .then((nextCandidates) => {
        if (cancelled) return;
        setLibraryCandidates(nextCandidates);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Sport activities fetch error:", error);
          setLibraryCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLibrary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    baseActivity,
    isSupportedSport,
    libraryDateFrom,
    libraryDateTo,
    libraryDurationRange,
    librarySearch,
    libraryWorkType,
    open,
    selectionMode,
  ]);

  const activeCandidates = selectionMode === "library" ? libraryCandidates : recommendedCandidates;

  useEffect(() => {
    if (!open) return;

    if (activeCandidates.length === 0) {
      setSelectedId("");
      setSelectedActivity(null);
      return;
    }

    setSelectedId((previousId) => {
      if (previousId && activeCandidates.some((candidate) => candidate.id === previousId)) {
        return previousId;
      }
      return activeCandidates[0]?.id ?? "";
    });
  }, [activeCandidates, open]);

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

  const setBaseRange = (range: ComparisonRangeSelection) => {
    setBaseRangeState(clampRange(range, baseMaxDistanceKm));
  };

  const setReferenceRange = (range: ComparisonRangeSelection) => {
    setReferenceRangeState(clampRange(range, referenceMaxDistanceKm));
  };

  const summary = useMemo<ComparisonSummary | null>(() => {
    if (!baseActivity || !selectedActivity) return null;
    return buildComparisonSummary(baseActivity, selectedActivity, baseRange, referenceRange);
  }, [baseActivity, baseRange, referenceRange, selectedActivity]);

  const chartModel = useMemo<SessionComparisonChartModel | null>(() => {
    if (!baseActivity || !selectedActivity) return null;
    return buildComparisonChartModel(baseActivity, selectedActivity, baseRange, referenceRange);
  }, [baseActivity, baseRange, referenceRange, selectedActivity]);

  return {
    candidates: recommendedCandidates,
    recommendedCandidates,
    libraryCandidates,
    selectedActivity,
    selectedId,
    setSelectedId,
    selectionMode,
    setSelectionMode,
    isLoadingCandidates,
    isLoadingLibrary,
    isLoadingSelected,
    isSupportedSport,
    hasComparableDistance,
    summary,
    chartModel,
    librarySearch,
    setLibrarySearch,
    libraryWorkType,
    setLibraryWorkType,
    libraryDurationRange,
    setLibraryDurationRange,
    libraryDateFrom,
    setLibraryDateFrom,
    libraryDateTo,
    setLibraryDateTo,
    hasActiveLibraryFilters,
    resetLibraryFilters: () => {
      setLibrarySearch("");
      setLibraryWorkType("");
      setLibraryDurationRange("");
      setLibraryDateFrom("");
      setLibraryDateTo("");
    },
    baseRange,
    referenceRange,
    setBaseRange,
    setReferenceRange,
    baseMaxDistanceKm,
    referenceMaxDistanceKm,
    canEditBaseRange,
    canEditReferenceRange,
  };
}
