import { supabase } from "@/lib/supabase";
import type { PhysioProfile } from "@/types/physio";
import { normalizePhysioProfileState, normalizePhysioSport } from "@/services/physio.service";

export async function getProfiles(athleteId: string): Promise<PhysioProfile[]> {
  const { data, error } = await supabase
    .from("physio_profiles")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("valid_from", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as PhysioProfile[]).map((profile) => ({
    ...profile,
    sport: normalizePhysioSport(profile.sport),
    profile_state: normalizePhysioProfileState(profile.profile_state),
  }));
}

export async function insertProfile(profile: Omit<PhysioProfile, "id">) {
  const normalizedSport = normalizePhysioSport(profile.sport);
  const normalizedState = normalizePhysioProfileState(profile.profile_state);
  const sportVariants =
    normalizedSport === "Bike"
      ? ["Bike", "bike", "VELO"]
      : ["Run", "run", "CAP"];

  // Check if an active profile already exists BEFORE closing it
  const { count } = await supabase
    .from("physio_profiles")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", profile.athlete_id)
    .in("sport", sportVariants)
    .eq("profile_state", normalizedState)
    .is("valid_to", null);

  const hadPreviousProfile = (count ?? 0) > 0;

  // Close previous active profile
  await supabase
    .from("physio_profiles")
    .update({ valid_to: new Date().toISOString() })
    .eq("athlete_id", profile.athlete_id)
    .in("sport", sportVariants)
    .eq("profile_state", normalizedState)
    .is("valid_to", null);

  const { data, error } = await supabase
    .from("physio_profiles")
    .insert({ ...profile, sport: normalizedSport, profile_state: normalizedState })
    .select()
    .single();

  if (error) throw error;
  return {
    data: {
      ...(data as PhysioProfile),
      sport: normalizePhysioSport((data as PhysioProfile).sport),
      profile_state: normalizePhysioProfileState((data as PhysioProfile).profile_state),
    },
    hadPreviousProfile,
  };
}

export async function triggerBatchReprocess(
  athleteId: string,
  sport: string,
  days = 28
): Promise<void> {
  const { error } = await supabase.functions.invoke("trigger-batch-reprocess", {
    body: { athlete_id: athleteId, sport, days },
  });
  if (error) throw error;
}
