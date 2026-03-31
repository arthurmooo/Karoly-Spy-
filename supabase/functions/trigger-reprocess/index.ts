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
    const { activity_id } = await req.json();
    if (!activity_id) {
      return new Response(JSON.stringify({ error: "activity_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch activity + verify coach ownership
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

    const athlete = activity.athletes as unknown as { coach_id: string };
    if (athlete.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: not your athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Trigger GitHub Actions via repository_dispatch
    const githubPat = Deno.env.get("GITHUB_PAT");
    if (!githubPat) {
      return new Response(JSON.stringify({ error: "GitHub PAT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghRes = await fetch(
      "https://api.github.com/repos/arthurmooo/Karoly-Spy-/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubPat}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "reprocess-activity",
          client_payload: { activity_id },
        }),
      }
    );

    if (!ghRes.ok) {
      const body = await ghRes.text();
      console.error("GitHub dispatch failed:", ghRes.status, body);
      return new Response(
        JSON.stringify({ error: `GitHub dispatch failed: ${ghRes.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
