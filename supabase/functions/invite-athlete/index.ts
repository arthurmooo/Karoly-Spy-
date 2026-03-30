import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate coach JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const { email, first_name, last_name, athlete_group_id } = await req.json();
    if (!email || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: "email, first_name, and last_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check if athlete with this email already exists
    const { data: existingAthlete } = await supabaseAdmin
      .from("athletes")
      .select("id, email, coach_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingAthlete) {
      // If athlete exists for a different coach, reject
      if (existingAthlete.coach_id && existingAthlete.coach_id !== user.id) {
        return new Response(JSON.stringify({ error: "This email belongs to another coach's athlete" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Athlete already exists for this coach (e.g. imported from Nolio) — just invite to auth
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.toLowerCase().trim(),
        { data: { role: "athlete" } }
      );

      if (inviteErr) {
        // If user already invited / exists in auth, not a fatal error
        if (inviteErr.message?.includes("already been registered")) {
          return new Response(
            JSON.stringify({ success: true, athlete_id: existingAthlete.id, already_registered: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw inviteErr;
      }

      // Link auth user to user_profiles if needed
      if (inviteData?.user) {
        await supabaseAdmin.from("user_profiles").upsert({
          id: inviteData.user.id,
          role: "athlete",
          display_name: `${first_name} ${last_name}`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, athlete_id: existingAthlete.id, linked: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. New athlete — invite via auth
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      { data: { role: "athlete" } }
    );

    if (inviteErr) throw inviteErr;

    // 5. Create user_profile
    if (inviteData?.user) {
      await supabaseAdmin.from("user_profiles").upsert({
        id: inviteData.user.id,
        role: "athlete",
        display_name: `${first_name} ${last_name}`,
      });
    }

    // 6. Create athlete record
    const athleteInsert: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.toLowerCase().trim(),
      coach_id: user.id,
      is_active: true,
    };
    if (athlete_group_id) {
      // Validate group belongs to this coach
      const { data: grp } = await supabaseAdmin
        .from("athlete_groups")
        .select("id")
        .eq("id", athlete_group_id)
        .eq("coach_id", user.id)
        .maybeSingle();
      if (grp) {
        athleteInsert.athlete_group_id = athlete_group_id;
      }
    }

    const { data: newAthlete, error: insertErr } = await supabaseAdmin
      .from("athletes")
      .insert(athleteInsert)
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ success: true, athlete_id: newAthlete.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
