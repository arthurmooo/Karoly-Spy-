import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_COLUMNS = new Set([
  "manual_interval_power_mean",
  "manual_interval_power_last",
  "manual_interval_hr_mean",
  "manual_interval_hr_last",
  "manual_interval_pace_mean",
  "manual_interval_pace_last",
  "manual_interval_block_1_power_mean",
  "manual_interval_block_1_power_last",
  "manual_interval_block_1_hr_mean",
  "manual_interval_block_1_hr_last",
  "manual_interval_block_1_pace_mean",
  "manual_interval_block_1_pace_last",
  "manual_interval_block_2_power_mean",
  "manual_interval_block_2_power_last",
  "manual_interval_block_2_hr_mean",
  "manual_interval_block_2_hr_last",
  "manual_interval_block_2_pace_mean",
  "manual_interval_block_2_pace_last",
  "manual_interval_block_1_count",
  "manual_interval_block_1_duration_sec",
  "manual_interval_block_2_count",
  "manual_interval_block_2_duration_sec",
]);

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

    // Verify the JWT and get user
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
    const { activity_id, overrides } = await req.json();
    if (!activity_id || !overrides || typeof overrides !== "object") {
      return new Response(JSON.stringify({ error: "activity_id and overrides required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Whitelist columns
    const sanitized: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (ALLOWED_COLUMNS.has(key)) {
        sanitized[key] = value === null ? null : Number(value);
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return new Response(JSON.stringify({ error: "No valid override columns provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch activity to verify coach ownership
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, athlete_id, athletes!inner(coach_id)")
      .eq("id", activity_id)
      .single();

    if (actErr || !activity) {
      return new Response(JSON.stringify({ error: "Activity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify coach owns this athlete
    const athlete = activity.athletes as unknown as { coach_id: string };
    if (athlete.coach_id && athlete.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: not your athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Execute UPDATE via admin client
    const { error: updateErr } = await supabaseAdmin
      .from("activities")
      .update(sanitized)
      .eq("id", activity_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true }),
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
