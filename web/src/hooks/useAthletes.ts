import { useState, useEffect } from "react";
import { getAthletes } from "@/repositories/athlete.repository";
import type { Athlete } from "@/types/athlete";

export function useAthletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAthletes()
      .then(setAthletes)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return { athletes, isLoading };
}
