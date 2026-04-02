import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { E2E_FIXTURES } from "./fixtures";

function readLocalSupabaseEnv() {
  const envPath = path.resolve(process.cwd(), "..", ".tmp", "e2e-functions.env");
  const raw = fs.readFileSync(envPath, "utf8");

  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

export function createSupabaseAdminClient() {
  const env = readLocalSupabaseEnv();
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing local Supabase env for invite e2e tests.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createCoachInviteLink(email: string, displayName: string, redirectTo: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { role: "coach" },
    },
  });

  if (error) throw error;
  if (!data.user || !data.properties.action_link) {
    throw new Error("Invite link generation did not return a user or action_link.");
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: data.user.id,
    role: "coach",
    display_name: displayName,
    email,
    structure_id: E2E_FIXTURES.structure.id,
    is_active: true,
  });

  if (profileError) throw profileError;

  return data.properties.action_link;
}

export async function createAthleteInviteLink(
  email: string,
  displayName: string,
  athleteId: string,
  redirectTo: string
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { role: "athlete" },
    },
  });

  if (error) throw error;
  if (!data.user || !data.properties.action_link) {
    throw new Error("Invite link generation did not return a user or action_link.");
  }

  const [firstName, ...rest] = displayName.split(" ");
  const lastName = rest.join(" ") || "Invite";

  const { error: athleteError } = await admin.from("athletes").upsert({
    id: athleteId,
    first_name: firstName,
    last_name: lastName,
    email,
    coach_id: E2E_FIXTURES.admin.id,
    structure_id: E2E_FIXTURES.structure.id,
    is_active: true,
  });

  if (athleteError) throw athleteError;

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: data.user.id,
    role: "athlete",
    display_name: displayName,
    email,
    athlete_id: athleteId,
  });

  if (profileError) throw profileError;

  return data.properties.action_link;
}
