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
    const { athlete_id, action, group_id } = await req.json();
    if (!athlete_id || !action) {
      return new Response(JSON.stringify({ error: "athlete_id and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verify coach owns this athlete
    const { data: athlete, error: athleteErr } = await supabaseAdmin
      .from("athletes")
      .select("id, coach_id")
      .eq("id", athlete_id)
      .single();

    if (athleteErr || !athlete) {
      return new Response(JSON.stringify({ error: "Athlete not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (athlete.coach_id && athlete.coach_id !== user.id) {
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
          // Verify group exists and belongs to this coach
          const { data: grp, error: grpErr } = await supabaseAdmin
            .from("athlete_groups")
            .select("id")
            .eq("id", group_id)
            .eq("coach_id", user.id)
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
