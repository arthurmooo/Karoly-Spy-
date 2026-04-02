import { supabase } from "@/lib/supabase";
import type { StructureAthleteAssignment, StructureCoach } from "@/types/admin";

function unwrap<T>(data: T | null, error: { message?: string } | null | undefined): T {
  if (error) throw error;
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    throw new Error(String((data as Record<string, unknown>).error));
  }
  return data as T;
}

export async function listStructureCoaches(): Promise<StructureCoach[]> {
  const { data, error } = await supabase.functions.invoke("manage-coach", {
    body: { action: "list" },
  });
  const result = unwrap<{ coaches: StructureCoach[] }>(data, error);
  return result.coaches ?? [];
}

export async function updateCoachStatus(profileId: string, isActive: boolean) {
  const { data, error } = await supabase.functions.invoke("manage-coach", {
    body: { action: "update_status", profile_id: profileId, is_active: isActive },
  });
  return unwrap(data, error);
}

export async function inviteCoach(payload: { email: string; display_name: string }) {
  const { data, error } = await supabase.functions.invoke("invite-coach", {
    body: {
      ...payload,
      redirect_to: `${window.location.origin}/accept-invite`,
    },
  });
  return unwrap(data, error);
}

export async function listStructureAthleteAssignments(): Promise<StructureAthleteAssignment[]> {
  const { data, error } = await supabase.functions.invoke("manage-athlete", {
    body: { action: "list_assignments" },
  });
  const result = unwrap<{ athletes: StructureAthleteAssignment[] }>(data, error);
  return result.athletes ?? [];
}

export async function assignAthleteCoach(athleteId: string, coachId: string | null) {
  const { data, error } = await supabase.functions.invoke("manage-athlete", {
    body: { action: "assign_coach", athlete_id: athleteId, coach_id: coachId },
  });
  return unwrap(data, error);
}
