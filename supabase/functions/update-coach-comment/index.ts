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
      .select("id, nolio_id, athlete_id, source_json, athletes!inner(nolio_id, coach_id)")
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
        const auth = await getNolioAccessToken(supabaseAdmin);
        if (!auth) {
          nolioDebug = "token_refresh_failed";
        } else {
          // Extract sport_id from source_json (Nolio requires it)
          const sourceJson = activity.source_json as Record<string, unknown> | null;
          const sportId = sourceJson?.sport_id ?? sourceJson?.planned_sport_id;

          const payload: Record<string, unknown> = {
            id_partner: auth.partnerId,
            id: Number(nolioId),
            description: comment,
          };
          if (sportId) payload.sport_id = Number(sportId);

          console.log("Nolio update payload:", JSON.stringify(payload));

          const nolioRes = await fetch("https://www.nolio.io/api/update/training/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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
): Promise<{ accessToken: string; partnerId: number } | null> {
  // Read all Nolio credentials from app_secrets
  const { data: secrets, error: secErr } = await supabase
    .from("app_secrets")
    .select("key, value")
    .in("key", ["NOLIO_CLIENT_ID", "NOLIO_CLIENT_SECRET", "NOLIO_REFRESH_TOKEN", "NOLIO_PARTNER_ID"]);

  if (secErr || !secrets || secrets.length < 4) {
    console.error("Cannot read Nolio secrets from app_secrets:", secErr?.message, "found:", secrets?.length);
    return null;
  }

  const secretMap = Object.fromEntries(secrets.map((s: { key: string; value: string }) => [s.key, s.value]));
  const clientId = secretMap["NOLIO_CLIENT_ID"];
  const clientSecret = secretMap["NOLIO_CLIENT_SECRET"];
  const refreshToken = secretMap["NOLIO_REFRESH_TOKEN"];
  const partnerId = secretMap["NOLIO_PARTNER_ID"];

  if (!clientId || !clientSecret || !refreshToken || !partnerId) {
    console.error("Missing Nolio credentials in app_secrets");
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
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Nolio token refresh failed:", tokenRes.status, await tokenRes.text());
    return null;
  }

  const tokenData = await tokenRes.json();

  // Always save new refresh token (Nolio uses rotating tokens — old one is now invalid)
  if (tokenData.refresh_token) {
    const { error: saveErr } = await supabase
      .from("app_secrets")
      .update({ value: tokenData.refresh_token, updated_at: new Date().toISOString() })
      .eq("key", "NOLIO_REFRESH_TOKEN");

    if (saveErr) {
      console.error("CRITICAL: Failed to save new refresh token to DB:", saveErr.message);
    } else {
      console.log("Refresh token saved to DB");
    }
  }

  return { accessToken: tokenData.access_token ?? null, partnerId: Number(partnerId) };
}
