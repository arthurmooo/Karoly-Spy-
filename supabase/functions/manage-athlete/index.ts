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
    const { athlete_id, action, group_id, coach_id } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_assignments") {
      if (callerProfile.role !== "admin" || !callerProfile.structure_id) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: athletes, error: athletesErr } = await supabaseAdmin
        .from("athletes")
        .select("id, first_name, last_name, email, is_active, start_date, coach_id")
        .eq("structure_id", callerProfile.structure_id)
        .order("last_name", { ascending: true });

      if (athletesErr) throw athletesErr;

      return new Response(
        JSON.stringify({ success: true, athletes: athletes ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!athlete_id) {
      return new Response(JSON.stringify({ error: "athlete_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verify caller can manage this athlete
    const { data: athlete, error: athleteErr } = await supabaseAdmin
      .from("athletes")
      .select("id, coach_id, structure_id")
      .eq("id", athlete_id)
      .single();

    if (athleteErr || !athlete) {
      return new Response(JSON.stringify({ error: "Athlete not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = callerProfile.role === "admin";
    if (isAdmin) {
      if (!callerProfile.structure_id || athlete.structure_id !== callerProfile.structure_id) {
        return new Response(JSON.stringify({ error: "Unauthorized athlete" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (athlete.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: not your athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Execute action
    let updatePayload: Record<string, unknown> = {};

    switch (action) {
      case "update_group": {
        if (group_id) {
          const expectedCoachId = athlete.coach_id ?? user.id;
          // Verify group exists and belongs to this coach
          const { data: grp, error: grpErr } = await supabaseAdmin
            .from("athlete_groups")
            .select("id")
            .eq("id", group_id)
            .eq("coach_id", expectedCoachId)
            .maybeSingle();
          if (grpErr || !grp) {
            return new Response(JSON.stringify({ error: "Invalid or unauthorized group" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        updatePayload = { athlete_group_id: group_id ?? null };
        break;
      }
      case "assign_coach": {
        if (!isAdmin || !callerProfile.structure_id) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (coach_id) {
          const { data: targetCoach, error: coachErr } = await supabaseAdmin
            .from("user_profiles")
            .select("id, role, structure_id, is_active")
            .eq("id", coach_id)
            .single();

          if (coachErr || !targetCoach) {
            return new Response(JSON.stringify({ error: "Coach not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (!["admin", "coach"].includes(targetCoach.role) || targetCoach.structure_id !== callerProfile.structure_id) {
            return new Response(JSON.stringify({ error: "Invalid target coach" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (targetCoach.is_active === false) {
            return new Response(JSON.stringify({ error: "Cannot assign to an inactive coach" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        updatePayload = {
          coach_id: coach_id ?? null,
          athlete_group_id: null,
          structure_id: callerProfile.structure_id,
        };
        break;
      }
      case "deactivate":
        updatePayload = { is_active: false };
        break;
      case "reactivate":
        updatePayload = { is_active: true };
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("athletes")
      .update(updatePayload)
      .eq("id", athlete_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, action, athlete_id }),
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
