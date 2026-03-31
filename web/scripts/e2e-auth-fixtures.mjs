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

const structure = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Structure Karoly",
};

const adminUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "coach.e2e@projectk.test",
  password: "CoachE2E!2026",
  displayName: "Admin E2E",
};

const collaboratorCoachUser = {
  id: "66666666-6666-4666-8666-666666666666",
  email: "collab.coach.e2e@projectk.test",
  password: "CoachCollabE2E!2026",
  displayName: "Coach Collab E2E",
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
    if (error.message?.includes("already been registered")) {
      return;
    }
    throw error;
  }
}

async function main() {
  await admin.from("structures").upsert([structure], { onConflict: "id" });

  await createAuthUser(adminUser);
  await createAuthUser(collaboratorCoachUser);
  await createAuthUser(athleteUser);

  const { error: profileError } = await admin.from("user_profiles").upsert(
    [
      {
        id: adminUser.id,
        role: "admin",
        display_name: adminUser.displayName,
        email: adminUser.email,
        structure_id: structure.id,
        is_active: true,
      },
      {
        id: collaboratorCoachUser.id,
        role: "coach",
        display_name: collaboratorCoachUser.displayName,
        email: collaboratorCoachUser.email,
        structure_id: structure.id,
        is_active: true,
      },
      {
        id: athleteUser.id,
        role: "athlete",
        display_name: athleteUser.displayName,
        email: athleteUser.email,
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
      coach_id: adminUser.id,
      structure_id: structure.id,
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
