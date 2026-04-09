import { useState, useEffect } from "react";
import { getProfiles } from "@/repositories/physio.repository";
import type { PhysioProfile } from "@/types/physio";
import { isFreshPhysioProfileState, normalizePhysioSport } from "@/services/physio.service";

export function useAthletePhysioProfile(
  athleteId: string | undefined,
  activityDate: string | undefined,
  sportType: string | undefined
) {
  const [profile, setProfile] = useState<PhysioProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!athleteId || !sportType) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getProfiles(athleteId)
      .then((profiles) => {
        if (cancelled) return;

        const normalizedSport = normalizePhysioSport(sportType);
        const date = activityDate ? new Date(activityDate) : new Date();

        // Find the profile valid at activityDate for this sport
        const match = profiles.find((p) => {
          if (normalizePhysioSport(p.sport) !== normalizedSport) return false;
          if (!isFreshPhysioProfileState(p.profile_state)) return false;
          const validFrom = new Date(p.valid_from);
          if (validFrom > date) return false;
          if (p.valid_to && new Date(p.valid_to) <= date) return false;
          return true;
        });

        setProfile(match ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Physio profile fetch error:", err);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [athleteId, activityDate, sportType]);

  return { profile, isLoading };
}
