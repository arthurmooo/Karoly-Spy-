import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_SECTION_KEYS = new Set([
  "form_analysis",
  "zone_distribution",
  "decoupling",
  "intervals_chart",
  "intervals_detail",
  "target_vs_actual",
  "segment_analysis",
  "phase_comparison",
]);

const SECTION_LABELS: Record<string, string> = {
  form_analysis: "Analyse de la forme",
  zone_distribution: "Distribution des zones",
  decoupling: "Découplage",
  intervals_chart: "Graphique intervalles",
  intervals_detail: "Détail intervalles",
  target_vs_actual: "Planifié vs Réalisé",
  segment_analysis: "Analyse par segments",
  phase_comparison: "Comparaison de phases",
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

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const { activity_id, section_key, comment } = await req.json();
    if (!activity_id || !section_key || typeof comment !== "string") {
      return new Response(
        JSON.stringify({ error: "activity_id, section_key and comment required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate section key
    if (!ALLOWED_SECTION_KEYS.has(section_key)) {
      return new Response(
        JSON.stringify({ error: `Invalid section_key: ${section_key}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch activity + verify coach ownership
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, athlete_id, section_comments, athletes!inner(coach_id)")
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

    // 5. Read-modify-write section_comments JSONB
    const comments = (activity.section_comments as Record<string, string>) ?? {};
    const trimmed = comment.trim();
    if (trimmed) {
      comments[section_key] = trimmed;
    } else {
      delete comments[section_key];
    }

    const newValue = Object.keys(comments).length > 0 ? comments : null;

    const { error: updateErr } = await supabaseAdmin
      .from("activities")
      .update({ section_comments: newValue })
      .eq("id", activity_id);

    if (updateErr) throw updateErr;

    // Insert notification for athlete if comment is non-empty (fire-and-forget)
    if (trimmed) {
      try {
        const label = SECTION_LABELS[section_key] ?? section_key;
        // Remove stale unread notification for the same activity + section to avoid duplicates
        await supabaseAdmin.from("notifications")
          .delete()
          .match({ activity_id, type: "section_comment", section_key, is_read: false });
        await supabaseAdmin.from("notifications").insert({
          athlete_id: activity.athlete_id,
          activity_id,
          type: "section_comment",
          section_key,
          message: `Commentaire coach : ${label}`,
        });
      } catch (notifErr) {
        console.error("Notification insert failed (non-blocking):", notifErr);
      }
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
