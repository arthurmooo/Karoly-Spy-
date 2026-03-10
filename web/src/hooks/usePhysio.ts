import { useState, useEffect, useCallback } from "react";
import { getProfiles, insertProfile } from "@/repositories/physio.repository";
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

  const addProfile = async (profile: Omit<PhysioProfile, "id">) => {
    await insertProfile(profile);
    await fetch();
  };

  return { profiles, activeProfiles, archivedProfiles, addProfile, isLoading };
}
