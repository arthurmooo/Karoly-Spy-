import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate coach JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
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
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    // 2. Parse body
    const { athlete_id, sport, days } = await req.json();
    if (!athlete_id || !sport) {
      return jsonResponse(
        { error: "athlete_id and sport are required" },
        400
      );
    }
    const reprocessDays = typeof days === "number" && days >= 1 && days <= 90
      ? days
      : 28;

    // 3. Fetch athlete and verify coach ownership
    const { data: athlete, error: athleteErr } = await supabaseAdmin
      .from("athletes")
      .select("id, first_name, coach_id")
      .eq("id", athlete_id)
      .single();

    if (athleteErr || !athlete) {
      return jsonResponse({ error: "Athlete not found" }, 404);
    }
    if (athlete.coach_id !== user.id) {
      return jsonResponse(
        { error: "Unauthorized: not your athlete" },
        403
      );
    }

    // 4. Dispatch GitHub Actions via repository_dispatch
    const githubPat = Deno.env.get("GITHUB_PAT");
    if (!githubPat) {
      return jsonResponse(
        { error: "GitHub PAT not configured" },
        500
      );
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
          event_type: "reprocess-batch",
          client_payload: {
            athlete_name: athlete.first_name,
            sport,
            days: String(reprocessDays),
          },
        }),
      }
    );

    if (!ghRes.ok) {
      const body = await ghRes.text();
      console.error("GitHub dispatch failed:", ghRes.status, body);
      return jsonResponse(
        { error: `GitHub dispatch failed: ${ghRes.status}` },
        502
      );
    }

    return jsonResponse({
      success: true,
      message: `Reprocessing triggered for ${athlete.first_name} (${sport}, last ${reprocessDays} days)`,
    });
  } catch (err) {
    console.error("Error:", (err as Error).message);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
