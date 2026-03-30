import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_WORK_TYPES = new Set(["endurance", "intervals", "competition"]);

function normalizeManualWorkType(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("manual_work_type must be a string or null");
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!ALLOWED_WORK_TYPES.has(normalized)) {
    throw new Error("manual_work_type must be endurance, intervals, competition, or null");
  }

  return normalized;
}

async function dispatchReprocess(activityId: string) {
  const githubPat = Deno.env.get("GITHUB_PAT");
  if (!githubPat) {
    return { ok: false, message: "GitHub PAT not configured" };
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
        client_payload: { activity_id: activityId },
      }),
    }
  );

  if (ghRes.ok) {
    return { ok: true, message: null };
  }

  const body = await ghRes.text();
  console.error("GitHub dispatch failed:", ghRes.status, body);
  return { ok: false, message: `GitHub dispatch failed: ${ghRes.status}` };
}

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
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const activityId = payload?.activity_id;
    const manualWorkType = normalizeManualWorkType(payload?.manual_work_type);

    if (!activityId) {
      return new Response(JSON.stringify({ error: "activity_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, athlete_id, work_type, detected_work_type, fit_file_path, athletes!inner(coach_id)")
      .eq("id", activityId)
      .single();

    if (actErr || !activity) {
      return new Response(JSON.stringify({ error: "Activity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const athlete = activity.athletes as unknown as { coach_id: string };
    if (athlete.coach_id && athlete.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: not your athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedWorkType = (activity.detected_work_type as string | null) ?? (activity.work_type as string | null);
    const effectiveWorkType = manualWorkType ?? detectedWorkType ?? "endurance";
    const canReprocess = Boolean(activity.fit_file_path);
    const analysisDirty = canReprocess;

    const { error: updateErr } = await supabaseAdmin
      .from("activities")
      .update({
        manual_work_type: manualWorkType,
        work_type: effectiveWorkType,
        analysis_dirty: analysisDirty,
      })
      .eq("id", activityId);

    if (updateErr) {
      throw updateErr;
    }

    if (!canReprocess) {
      return new Response(
        JSON.stringify({
          success: true,
          work_type: effectiveWorkType,
          manual_work_type: manualWorkType,
          detected_work_type: detectedWorkType,
          analysis_dirty: false,
          reprocess_dispatched: false,
          warning: "Type mis a jour sans recalcul: aucun FIT stocke pour cette seance.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dispatch = await dispatchReprocess(activityId);

    return new Response(
      JSON.stringify({
        success: true,
        work_type: effectiveWorkType,
        manual_work_type: manualWorkType,
        detected_work_type: detectedWorkType,
        analysis_dirty: true,
        reprocess_dispatched: dispatch.ok,
        warning: dispatch.ok ? null : dispatch.message,
      }),
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
