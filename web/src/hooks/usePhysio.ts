import { useState, useEffect, useCallback } from "react";
import { getProfiles, insertProfile, triggerBatchReprocess } from "@/repositories/physio.repository";
import { isFreshPhysioProfileState, normalizePhysioSport } from "@/services/physio.service";
import { toast } from "sonner";
import type { PhysioProfile } from "@/types/physio";

export function usePhysio(athleteId: string | null) {
  const [profiles, setProfiles] = useState<PhysioProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!athleteId) return;
    setIsLoading(true);
    try {
      const data = await getProfiles(athleteId);
      setProfiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const activeProfiles = profiles.filter((p) => !p.valid_to);
  const archivedProfiles = profiles.filter((p) => !!p.valid_to);
  const freshActiveProfiles = activeProfiles.filter((p) => isFreshPhysioProfileState(p.profile_state));

  const MLS_SPORTS = ["Run", "Bike"];

  const addProfile = async (profile: Omit<PhysioProfile, "id">) => {
    await insertProfile(profile);
    const sport = normalizePhysioSport(profile.sport);
    const isFreshProfile = isFreshPhysioProfileState(profile.profile_state);

    if (isFreshProfile && MLS_SPORTS.includes(sport)) {
      try {
        await triggerBatchReprocess(profile.athlete_id, sport);
        toast.success(
          "Profil enregistré. Recalcul du MLS en cours pour les 4 dernières semaines..."
        );
      } catch (e) {
        console.error("Batch reprocess trigger failed:", e);
        toast.warning(
          "Profil enregistré, mais le recalcul automatique n'a pas pu être lancé."
        );
      }
    }

    await fetch();
  };

  return { profiles, activeProfiles, archivedProfiles, freshActiveProfiles, addProfile, isLoading };
}
