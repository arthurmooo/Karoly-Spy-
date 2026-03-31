import { useEffect, useState } from "react";
import { getNextPlannedWorkout, type PlannedWorkout } from "@/repositories/calendar.repository";

export function useNextPlannedWorkout(athleteId: string | null) {
  const [workout, setWorkout] = useState<PlannedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) {
      setWorkout(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getNextPlannedWorkout(athleteId)
      .then((data) => {
        if (!cancelled) setWorkout(data);
      })
      .catch((err) => {
        console.error("Failed to fetch next planned workout:", err);
        if (!cancelled) setWorkout(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return { workout, isLoading };
}
