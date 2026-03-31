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

    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("role, structure_id, is_active")
      .eq("id", user.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["admin", "coach"].includes(callerProfile.role) || callerProfile.is_active === false) {
      return new Response(JSON.stringify({ error: "Coach access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const { email, first_name, last_name, athlete_group_id, coach_id } = await req.json();
    if (!email || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: "email, first_name, and last_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetCoachId: string | null = user.id;
    let targetStructureId: string | null = callerProfile.structure_id ?? null;

    if (callerProfile.role === "admin") {
      targetCoachId = coach_id ?? null;
      if (!targetStructureId) {
        return new Response(JSON.stringify({ error: "Admin has no structure" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (coach_id && coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Coaches can only invite athletes for themselves" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetCoachId) {
      const { data: targetCoach, error: coachErr } = await supabaseAdmin
        .from("user_profiles")
        .select("id, role, structure_id, is_active")
        .eq("id", targetCoachId)
        .single();

      if (coachErr || !targetCoach) {
        return new Response(JSON.stringify({ error: "Target coach not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["admin", "coach"].includes(targetCoach.role) || targetCoach.is_active === false) {
        return new Response(JSON.stringify({ error: "Invalid target coach" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (callerProfile.role === "admin" && targetCoach.structure_id !== targetStructureId) {
        return new Response(JSON.stringify({ error: "Coach belongs to another structure" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetStructureId = targetCoach.structure_id ?? targetStructureId;
    }

    // 3. Check if athlete with this email already exists
    const { data: existingAthlete } = await supabaseAdmin
      .from("athletes")
      .select("id, email, coach_id, structure_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingAthlete) {
      const sameStructure =
        !existingAthlete.structure_id ||
        !targetStructureId ||
        existingAthlete.structure_id === targetStructureId;

      if (!sameStructure) {
        return new Response(JSON.stringify({ error: "This email belongs to another coach's athlete" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (callerProfile.role !== "admin" && existingAthlete.coach_id && existingAthlete.coach_id !== user.id) {
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
          email: email.toLowerCase().trim(),
        });
      }

      let validatedGroupId: string | null = null;
      if (athlete_group_id && targetCoachId) {
        const { data: grp } = await supabaseAdmin
          .from("athlete_groups")
          .select("id")
          .eq("id", athlete_group_id)
          .eq("coach_id", targetCoachId)
          .maybeSingle();
        validatedGroupId = grp?.id ?? null;
      }

      await supabaseAdmin
        .from("athletes")
        .update({
          coach_id: targetCoachId,
          structure_id: targetStructureId,
          athlete_group_id: validatedGroupId,
        })
        .eq("id", existingAthlete.id);

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
        email: email.toLowerCase().trim(),
      });
    }

    // 6. Create athlete record
    const athleteInsert: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.toLowerCase().trim(),
      coach_id: targetCoachId,
      structure_id: targetStructureId,
      is_active: true,
    };
    if (athlete_group_id) {
      // Validate group belongs to this coach
      const { data: grp } = await supabaseAdmin
        .from("athlete_groups")
        .select("id")
        .eq("id", athlete_group_id)
        .eq("coach_id", targetCoachId)
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
