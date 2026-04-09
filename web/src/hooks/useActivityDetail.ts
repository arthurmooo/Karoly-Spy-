import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchActivityStreams,
  getActivityDetail,
  triggerReprocess,
  updateActivityType,
  updateAthleteFeedback,
  updateCoachComment,
  updateSectionComment,
  updateManualIntervalOverrides,
} from "@/repositories/activity.repository";
import type { Activity, ActivityInterval, WorkTypeValue } from "@/types/activity";
import type { ManualIntervalsUpdatePayload } from "@/services/manualIntervals.service";
import { isBikeSport } from "@/services/activity.service";

function hasElapsedStreamMapping(activity: Activity | null | undefined) {
  return (
    activity?.activity_streams?.some(
      (point) => typeof point.elapsed_t === "number" && Number.isFinite(point.elapsed_t)
    ) ?? false
  );
}

function hasDistanceStreamMapping(activity: Activity | null | undefined) {
  return (
    activity?.activity_streams?.some(
      (point) => typeof point.dist_m === "number" && Number.isFinite(point.dist_m)
    ) ?? false
  );
}

function hasRequiredStreamMappings(activity: Activity | null | undefined) {
  return hasElapsedStreamMapping(activity) && hasDistanceStreamMapping(activity);
}

function hasRequiredLapPowerMappings(activity: Activity | null | undefined) {
  if (!activity || !isBikeSport(activity.sport_type) || !activity.garmin_laps?.length) return true;
  return activity.garmin_laps.every(
    (lap) =>
      typeof lap.avg_power_with_zeros === "number" &&
      Number.isFinite(lap.avg_power_with_zeros)
  );
}

export function useActivityDetail(id: string | undefined) {
  const { user, loading: authLoading } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [intervals, setIntervals] = useState<ActivityInterval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nolioSynced, setNolioSynced] = useState<boolean | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSavingWorkType, setIsSavingWorkType] = useState(false);
  const [workTypeSaveError, setWorkTypeSaveError] = useState<string | null>(null);
  const [workTypeWarning, setWorkTypeWarning] = useState<string | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [feedbackSaveError, setFeedbackSaveError] = useState<string | null>(null);
  const streamFetchAttemptsRef = useRef<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    if (!id) return;
    const { activity: act, intervals: ints } = await getActivityDetail(id);
    setActivity((prev) => {
      const merged = act as unknown as Activity;
      // Preserve streams/laps if DB hasn't cached them yet (fire-and-forget write)
      if (!merged.activity_streams?.length && prev?.activity_streams?.length) {
        merged.activity_streams = prev.activity_streams;
      } else if (!hasRequiredStreamMappings(merged) && hasRequiredStreamMappings(prev)) {
        merged.activity_streams = prev?.activity_streams;
      }
      if (!merged.garmin_laps?.length && prev?.garmin_laps?.length) {
        merged.garmin_laps = prev.garmin_laps;
      }
      if (merged.id && hasRequiredStreamMappings(merged)) {
        delete streamFetchAttemptsRef.current[merged.id];
      }
      return merged;
    });
    setIntervals(ints as ActivityInterval[]);
  }, [id]);

  useEffect(() => {
    if (!id || authLoading) return;
    let cancelled = false;
    setIsLoading(true);

    refresh()
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, id, refresh]);

  useEffect(() => {
    if (!activity?.id || !activity.analysis_dirty) return;

    const pollId = window.setInterval(() => {
      refresh().catch((err) => {
        console.error("Activity dirty refresh error:", err);
      });
    }, 20000);

    return () => window.clearInterval(pollId);
  }, [activity?.id, activity?.analysis_dirty, refresh]);

  // Auto-fetch streams via Edge Function if not cached in DB
  useEffect(() => {
    if (!id || !activity) return;
    if (!activity.fit_file_path) return;

    const activityId = activity.id;
    const hasRequiredMappings = hasRequiredStreamMappings(activity);
    const hasRequiredLaps = hasRequiredLapPowerMappings(activity);
    const needsStreamFetch = !activity.activity_streams?.length || !hasRequiredMappings || !hasRequiredLaps;
    if (!needsStreamFetch) return;
    if (streamFetchAttemptsRef.current[activityId]) return;

    let cancelled = false;
    streamFetchAttemptsRef.current[activityId] = true;
    setIsLoadingStreams(true);

    fetchActivityStreams(id)
      .then((result) => {
        if (cancelled) return;
        if (result.streams || result.laps) {
          const nextHasRequiredMappings =
            result.streams?.some(
              (point) =>
                typeof point.elapsed_t === "number" &&
                Number.isFinite(point.elapsed_t) &&
                typeof point.dist_m === "number" &&
                Number.isFinite(point.dist_m)
            ) ?? false;

          setActivity((prev) =>
            prev
              ? {
                  ...prev,
                  activity_streams: result.streams ?? prev.activity_streams,
                  garmin_laps: result.laps ?? prev.garmin_laps,
                }
              : prev
          );

          if (nextHasRequiredMappings) {
            delete streamFetchAttemptsRef.current[activityId];
          }
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Stream fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStreams(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    activity?.id,
    activity?.fit_file_path,
    activity?.activity_streams?.length,
    activity ? hasRequiredStreamMappings(activity) : false,
  ]);

  const saveCoachComment = useCallback(
    async (comment: string) => {
      if (!id) return;
      setIsSaving(true);
      setSaveError(null);
      setNolioSynced(null);

      // Optimistic update
      setActivity((prev) => (prev ? { ...prev, coach_comment: comment } : prev));

      try {
        const result = await updateCoachComment(id, comment);
        setNolioSynced(result.nolio_synced);
      } catch (err) {
        // Revert optimistic update
        setActivity((prev) => (prev ? { ...prev, coach_comment: prev.coach_comment } : prev));
        setSaveError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
      } finally {
        setIsSaving(false);
      }
    },
    [id]
  );

  const saveSectionComment = useCallback(
    async (sectionKey: string, comment: string) => {
      if (!id) return;

      // Optimistic update
      setActivity((prev) => {
        if (!prev) return prev;
        const current = { ...(prev.section_comments ?? {}) };
        const trimmed = comment.trim();
        if (trimmed) {
          current[sectionKey] = trimmed;
        } else {
          delete current[sectionKey];
        }
        return {
          ...prev,
          section_comments: Object.keys(current).length > 0 ? current : null,
        };
      });

      try {
        await updateSectionComment(id, sectionKey, comment);
      } catch (err) {
        // Revert optimistic update
        await refresh();
        throw err;
      }
    },
    [id, refresh]
  );

  const saveAthleteFeedback = useCallback(
    async (rating: number | null, text: string) => {
      if (!id) return;
      setIsSavingFeedback(true);
      setFeedbackSaveError(null);

      const prevRating = activity?.athlete_feedback_rating;
      const prevText = activity?.athlete_feedback_text;

      // Optimistic update
      setActivity((prev) =>
        prev ? { ...prev, athlete_feedback_rating: rating, athlete_feedback_text: text } : prev
      );

      try {
        await updateAthleteFeedback(id, rating, text);
      } catch (err) {
        // Revert
        setActivity((prev) =>
          prev
            ? { ...prev, athlete_feedback_rating: prevRating ?? null, athlete_feedback_text: prevText ?? null }
            : prev
        );
        setFeedbackSaveError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
      } finally {
        setIsSavingFeedback(false);
      }
    },
    [id, activity?.athlete_feedback_rating, activity?.athlete_feedback_text]
  );

  const handleReprocess = useCallback(async () => {
    if (!id) return;
    setIsReprocessing(true);
    try {
      await triggerReprocess(id);
      setWorkTypeWarning(null);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors du recalcul";
      return { success: false, error: message };
    } finally {
      setIsReprocessing(false);
    }
  }, [id]);

  const saveManualDetectorOverride = useCallback(
    async (payload: ManualIntervalsUpdatePayload) => {
      if (!id) return;
      // Optimistic update — show manual values immediately
      setActivity((prev) =>
        prev
          ? {
              ...prev,
              ...payload.overrides,
              manual_interval_segments: payload.manual_interval_segments,
              interval_detection_source:
                payload.manual_interval_segments.length > 0 ? "manual" : prev.interval_detection_source,
            }
          : prev
      );
      try {
        await updateManualIntervalOverrides(id, payload);
        await refresh();
      } catch (err) {
        await refresh(); // revert optimistic update
        console.error("Manual override save error:", err);
        throw err;
      }
    },
    [id, refresh]
  );

  const saveWorkType = useCallback(
    async (manualWorkType: WorkTypeValue | null) => {
      if (!id) return { success: false, error: "Activité introuvable", reprocessDispatched: false };

      setIsSavingWorkType(true);
      setWorkTypeSaveError(null);
      setWorkTypeWarning(null);

      const previousActivity = activity;
      const normalizedManual = manualWorkType ?? null;
      const fallbackDetected = previousActivity?.detected_work_type ?? previousActivity?.work_type ?? "endurance";
      const optimisticWorkType = normalizedManual ?? fallbackDetected;

      setActivity((prev) =>
        prev
          ? {
              ...prev,
              manual_work_type: normalizedManual,
              work_type: optimisticWorkType,
              analysis_dirty: Boolean(prev.fit_file_path),
            }
          : prev
      );

      try {
        const result = await updateActivityType(id, normalizedManual);
        setActivity((prev) =>
          prev
            ? {
                ...prev,
                manual_work_type: result.manual_work_type,
                detected_work_type: result.detected_work_type ?? prev.detected_work_type ?? null,
                work_type: result.work_type,
                analysis_dirty: result.analysis_dirty,
              }
            : prev
        );
        if (result.warning) {
          setWorkTypeWarning(result.warning);
        }
        return {
          success: true,
          reprocessDispatched: result.reprocess_dispatched,
          warning: result.warning ?? null,
        };
      } catch (err) {
        setActivity(previousActivity ?? null);
        const message = err instanceof Error ? err.message : "Erreur lors de la mise à jour du type";
        setWorkTypeSaveError(message);
        return { success: false, error: message, reprocessDispatched: false };
      } finally {
        setIsSavingWorkType(false);
      }
    },
    [activity, id]
  );

  return {
    activity,
    intervals,
    isLoading,
    isLoadingStreams,
    isSaving,
    saveError,
    nolioSynced,
    saveCoachComment,
    saveSectionComment,
    saveManualDetectorOverride,
    saveWorkType,
    handleReprocess,
    isReprocessing,
    isSavingWorkType,
    workTypeSaveError,
    workTypeWarning,
    refresh,
    isSavingFeedback,
    feedbackSaveError,
    saveAthleteFeedback,
  };
}
