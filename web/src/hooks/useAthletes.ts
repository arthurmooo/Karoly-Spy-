import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAthletes } from "@/repositories/athlete.repository";
import type { Athlete } from "@/types/athlete";

export function useAthletes() {
  const { user, loading: authLoading } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    setIsLoading(true);
    getAthletes()
      .then(setAthletes)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [authLoading, user?.id]);

  return { athletes, isLoading };
}
