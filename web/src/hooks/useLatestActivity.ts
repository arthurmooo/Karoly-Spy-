import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LatestActivity {
  id: string;
  session_date: string;
  sport_type: string | null;
  work_type: string | null;
  activity_name: string | null;
  manual_activity_name: string | null;
  duration_sec: number | null;
  moving_time_sec: number | null;
  distance_m: number | null;
  load_index: number | null;
  rpe: number | null;
  avg_hr: number | null;
  coach_comment: string | null;
}

const COLUMNS =
  "id, session_date, sport_type, work_type, activity_name, manual_activity_name, duration_sec, moving_time_sec, distance_m, load_index, rpe, avg_hr, coach_comment";

export function useLatestActivity(athleteId: string | null) {
  const [activity, setActivity] = useState<LatestActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) {
      setActivity(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("activities")
          .select(COLUMNS)
          .eq("athlete_id", athleteId)
          .order("session_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch latest activity:", error);
          setActivity(null);
        } else {
          setActivity(data as LatestActivity | null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch latest activity:", err);
          setActivity(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return { activity, isLoading };
}
