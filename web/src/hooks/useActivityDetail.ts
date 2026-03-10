import { useState, useEffect, useCallback } from "react";
import {
  fetchActivityStreams,
  getActivityDetail,
  updateCoachComment,
  updateManualIntervalOverrides,
} from "@/repositories/activity.repository";
import type { Activity, ActivityInterval } from "@/types/activity";
import type { ManualBlockOverridePayload } from "@/services/manualIntervals.service";

export function useActivityDetail(id: string | undefined) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [intervals, setIntervals] = useState<ActivityInterval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nolioSynced, setNolioSynced] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const { activity: act, intervals: ints } = await getActivityDetail(id);
    setActivity((prev) => {
      const merged = act as unknown as Activity;
      // Preserve streams/laps if DB hasn't cached them yet (fire-and-forget write)
      if (!merged.activity_streams?.length && prev?.activity_streams?.length) {
        merged.activity_streams = prev.activity_streams;
      }
      if (!merged.garmin_laps?.length && prev?.garmin_laps?.length) {
        merged.garmin_laps = prev.garmin_laps;
      }
      return merged;
    });
    setIntervals(ints as ActivityInterval[]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
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
  }, [id, refresh]);

  // Auto-fetch streams via Edge Function if not cached in DB
  useEffect(() => {
    if (!id || !activity) return;
    if (activity.activity_streams?.length) return; // already have streams
    if (!activity.fit_file_path) return; // no FIT file available

    let cancelled = false;
    setIsLoadingStreams(true);

    fetchActivityStreams(id)
      .then((result) => {
        if (cancelled) return;
        if (result.streams || result.laps) {
          setActivity((prev) =>
            prev
              ? {
                  ...prev,
                  activity_streams: result.streams ?? prev.activity_streams,
                  garmin_laps: result.laps ?? prev.garmin_laps,
                }
              : prev
          );
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
  }, [id, activity?.fit_file_path, activity?.activity_streams?.length]);

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

  const saveManualDetectorOverride = useCallback(
    async (payload: ManualBlockOverridePayload) => {
      if (!id) return;
      // Optimistic update — show manual values immediately
      setActivity((prev) => (prev ? { ...prev, ...payload } : prev));
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

  return {
    activity,
    intervals,
    isLoading,
    isLoadingStreams,
    isSaving,
    saveError,
    nolioSynced,
    saveCoachComment,
    saveManualDetectorOverride,
    refresh,
  };
}
