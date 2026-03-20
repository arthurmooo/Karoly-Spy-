import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for e2e auth fixtures.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const coachUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "coach.e2e@projectk.test",
  password: "CoachE2E!2026",
  displayName: "Coach E2E",
};

const athleteUser = {
  id: "11111111-1111-4111-8111-111111111111",
  athleteId: "33333333-3333-4333-8333-333333333333",
  email: "athlete.e2e@projectk.test",
  password: "AthleteE2E!2026",
  displayName: "Athlete E2E",
};

async function createAuthUser({ id, email, password, displayName }) {
  const { error } = await admin.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
    },
  });

  if (error) {
    throw error;
  }
}

async function main() {
  await createAuthUser(coachUser);
  await createAuthUser(athleteUser);

  const { error: profileError } = await admin.from("user_profiles").upsert(
    [
      {
        id: coachUser.id,
        role: "coach",
        display_name: coachUser.displayName,
      },
      {
        id: athleteUser.id,
        role: "athlete",
        display_name: athleteUser.displayName,
        athlete_id: athleteUser.athleteId,
      },
    ],
    { onConflict: "id" }
  );

  if (profileError) {
    throw profileError;
  }

  const { error: athleteError } = await admin
    .from("athletes")
    .update({
      coach_id: coachUser.id,
      email: athleteUser.email,
    })
    .eq("id", athleteUser.athleteId);

  if (athleteError) {
    throw athleteError;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
