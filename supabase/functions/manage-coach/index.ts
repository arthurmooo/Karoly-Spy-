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

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

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

    if (callerProfile.role !== "admin" || callerProfile.is_active === false || !callerProfile.structure_id) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, profile_id, is_active } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: coaches, error: coachesErr } = await supabaseAdmin
        .from("user_profiles")
        .select("id, display_name, email, role, is_active, created_at")
        .eq("structure_id", callerProfile.structure_id)
        .in("role", ["admin", "coach"])
        .order("created_at", { ascending: true });

      if (coachesErr) throw coachesErr;

      const coachIds = (coaches ?? []).map((coach) => coach.id);
      const { data: athletes, error: athletesErr } = coachIds.length
        ? await supabaseAdmin.from("athletes").select("coach_id").in("coach_id", coachIds)
        : { data: [], error: null };

      if (athletesErr) throw athletesErr;

      const athleteCountByCoach = new Map<string, number>();
      for (const athlete of athletes ?? []) {
        const coachId = athlete.coach_id as string | null;
        if (!coachId) continue;
        athleteCountByCoach.set(coachId, (athleteCountByCoach.get(coachId) ?? 0) + 1);
      }

      const payload = (coaches ?? []).map((coach) => ({
        ...coach,
        athlete_count: athleteCountByCoach.get(coach.id) ?? 0,
      }));

      return new Response(JSON.stringify({ success: true, coaches: payload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_status") {
      if (!profile_id || typeof is_active !== "boolean") {
        return new Response(JSON.stringify({ error: "profile_id and is_active required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetCoach, error: targetErr } = await supabaseAdmin
        .from("user_profiles")
        .select("id, role, structure_id")
        .eq("id", profile_id)
        .single();

      if (targetErr || !targetCoach) {
        return new Response(JSON.stringify({ error: "Coach not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetCoach.role !== "coach" || targetCoach.structure_id !== callerProfile.structure_id) {
        return new Response(JSON.stringify({ error: "Invalid target coach" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("user_profiles")
        .update({ is_active })
        .eq("id", profile_id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ success: true, profile_id, is_active }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
