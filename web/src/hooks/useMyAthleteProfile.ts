import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Athlete } from "@/types/athlete";

const ATHLETE_COLUMNS = "id, first_name, last_name, nolio_id, email, is_active, start_date, athlete_group_id, avatar_url";

export function useMyAthleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Athlete | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    setIsLoading(true);

    async function fetchProfile() {
      try {
        const { data, error } = await supabase
          .from("athletes")
          .select(ATHLETE_COLUMNS)
          .single();

        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch athlete profile:", error);
          setProfile(null);
        } else {
          setProfile(data as Athlete);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch athlete profile:", err);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  return { profile, isLoading };
}
