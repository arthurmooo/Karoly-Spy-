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
    const { activity_id, comment } = await req.json();
    if (!activity_id || typeof comment !== "string") {
      return new Response(JSON.stringify({ error: "activity_id and comment required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch activity to get nolio_id + athlete_id, verify coach ownership
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, nolio_id, athlete_id, athletes!inner(nolio_id, coach_id)")
      .eq("id", activity_id)
      .single();

    if (actErr || !activity) {
      return new Response(JSON.stringify({ error: "Activity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify coach owns this athlete
    const athlete = activity.athletes as unknown as { nolio_id: string; coach_id: string };
    if (athlete.coach_id && athlete.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: not your athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Update coach_comment in DB
    const { error: updateErr } = await supabaseAdmin
      .from("activities")
      .update({ coach_comment: comment })
      .eq("id", activity_id);

    if (updateErr) throw updateErr;

    // 5. Sync to Nolio if nolio_id exists
    let nolioSynced = false;
    let nolioDebug = "";
    const nolioId = activity.nolio_id;
    const athleteNolioId = athlete.nolio_id;

    if (!nolioId || !athleteNolioId) {
      nolioDebug = `skip: nolio_id=${nolioId}, athlete_nolio_id=${athleteNolioId}`;
    } else {
      try {
        const accessToken = await getNolioAccessToken(supabaseAdmin);
        if (!accessToken) {
          nolioDebug = "token_refresh_failed";
        } else {
          const nolioRes = await fetch("https://www.nolio.io/api/update/training/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: nolioId,
              description: comment,
              athlete_id: athleteNolioId,
            }),
          });
          if (nolioRes.ok) {
            nolioSynced = true;
            nolioDebug = "ok";
          } else {
            const body = await nolioRes.text();
            nolioDebug = `nolio_api_error: ${nolioRes.status} ${body}`;
            console.error("Nolio sync failed:", nolioRes.status, body);
          }
        }
      } catch (nolioErr) {
        nolioDebug = `exception: ${nolioErr.message}`;
        console.error("Nolio sync error:", nolioErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, nolio_synced: nolioSynced, nolio_debug: nolioDebug }),
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

/**
 * Get a valid Nolio access token using refresh token from app_secrets.
 * Refreshes the token if needed and saves the new refresh token.
 */
async function getNolioAccessToken(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const clientId = Deno.env.get("NOLIO_CLIENT_ID");
  const clientSecret = Deno.env.get("NOLIO_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("Missing NOLIO_CLIENT_ID or NOLIO_CLIENT_SECRET");
    return null;
  }

  // Read refresh token from app_secrets
  const { data: secret, error: secErr } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", "NOLIO_REFRESH_TOKEN")
    .single();

  if (secErr || !secret?.value) {
    console.error("Cannot read NOLIO_REFRESH_TOKEN from app_secrets:", secErr?.message);
    return null;
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const tokenRes = await fetch("https://www.nolio.io/api/token/", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: secret.value,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Nolio token refresh failed:", tokenRes.status, await tokenRes.text());
    return null;
  }

  const tokenData = await tokenRes.json();

  // Save new refresh token if changed
  if (tokenData.refresh_token && tokenData.refresh_token !== secret.value) {
    await supabase
      .from("app_secrets")
      .update({ value: tokenData.refresh_token })
      .eq("key", "NOLIO_REFRESH_TOKEN");
  }

  return tokenData.access_token ?? null;
}
