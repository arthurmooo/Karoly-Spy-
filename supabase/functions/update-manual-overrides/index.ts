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
  "manual_interval_block_3_power_mean",
  "manual_interval_block_3_power_last",
  "manual_interval_block_3_hr_mean",
  "manual_interval_block_3_hr_last",
  "manual_interval_block_3_pace_mean",
  "manual_interval_block_3_pace_last",
  "manual_interval_block_3_count",
  "manual_interval_block_3_duration_sec",
]);

type ManualIntervalSegment = {
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  distance_m: number;
  avg_speed: number | null;
  avg_power: number | null;
  avg_hr: number | null;
};

type ManualIntervalBlock = {
  block_index: number;
  segments: ManualIntervalSegment[];
};

function sanitizeSegments(raw: unknown): ManualIntervalBlock[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const sourceBlock = block as Record<string, unknown>;
      const blockIndex = Number(sourceBlock.block_index);
      if (!Number.isFinite(blockIndex)) return null;
      const rawSegments = Array.isArray(sourceBlock.segments) ? sourceBlock.segments : [];
      const segments = rawSegments
        .map((segment) => {
          if (!segment || typeof segment !== "object") return null;
          const sourceSegment = segment as Record<string, unknown>;
          const startSec = Number(sourceSegment.start_sec);
          const endSec = Number(sourceSegment.end_sec);
          const durationSec = Number(sourceSegment.duration_sec);
          const distanceM = Number(sourceSegment.distance_m);
          if (
            !Number.isFinite(startSec) ||
            !Number.isFinite(endSec) ||
            !Number.isFinite(durationSec) ||
            !Number.isFinite(distanceM) ||
            endSec <= startSec ||
            durationSec <= 0
          ) {
            return null;
          }

          const nullableNumber = (value: unknown) =>
            value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;

          return {
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: durationSec,
            distance_m: distanceM,
            avg_speed: nullableNumber(sourceSegment.avg_speed),
            avg_power: nullableNumber(sourceSegment.avg_power),
            avg_hr: nullableNumber(sourceSegment.avg_hr),
          } satisfies ManualIntervalSegment;
        })
        .filter((segment): segment is ManualIntervalSegment => segment !== null)
        .sort((left, right) => left.start_sec - right.start_sec);

      if (segments.length === 0) return null;

      return {
        block_index: blockIndex,
        segments,
      } satisfies ManualIntervalBlock;
    })
    .filter((block): block is ManualIntervalBlock => block !== null)
    .sort((left, right) => left.block_index - right.block_index);
}

function buildManualIntervals(activityId: string, blocks: ManualIntervalBlock[]) {
  return blocks.flatMap((block) =>
    block.segments.map((segment) => ({
      activity_id: activityId,
      start_time: segment.start_sec,
      end_time: segment.end_sec,
      duration: segment.duration_sec,
      type: "work",
      detection_source: "manual",
      avg_speed: segment.avg_speed,
      avg_power: segment.avg_power,
      avg_hr: segment.avg_hr,
      avg_cadence: null,
      pa_hr_ratio: null,
      decoupling: null,
      respect_score: null,
    }))
  );
}

async function dispatchReprocess(activityId: string) {
  const githubPat = Deno.env.get("GITHUB_PAT");
  if (!githubPat) {
    console.warn("GITHUB_PAT not configured; skipping reprocess dispatch");
    return false;
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

  if (!ghRes.ok) {
    const body = await ghRes.text();
    console.error("GitHub dispatch failed:", ghRes.status, body);
    return false;
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Parse body
    const { activity_id, overrides, manual_interval_segments, reset_to_auto } = await req.json();
    if (!activity_id || !overrides || typeof overrides !== "object") {
      return new Response(JSON.stringify({ error: "activity_id and overrides required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Whitelist columns
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

    const sanitizedSegments = sanitizeSegments(manual_interval_segments);

    // 3. Verify activity exists
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, athlete_id")
      .eq("id", activity_id)
      .single();

    if (actErr || !activity) {
      return new Response(JSON.stringify({ error: "Activity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Execute UPDATE via admin client
    const shouldResetToAuto = Boolean(reset_to_auto) && sanitizedSegments.length === 0;
    const manualIntervals = buildManualIntervals(activity_id, sanitizedSegments);
    const activityUpdate: Record<string, unknown> = {
      ...sanitized,
      manual_interval_segments: sanitizedSegments.length > 0 ? sanitizedSegments : null,
      analysis_dirty: shouldResetToAuto,
    };
    if (sanitizedSegments.length > 0) {
      activityUpdate.interval_detection_source = "manual";
    } else if (shouldResetToAuto) {
      activityUpdate.interval_detection_source = null;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("activities")
      .update(activityUpdate)
      .eq("id", activity_id);

    if (updateErr) throw updateErr;

    const { error: deleteErr } = await supabaseAdmin
      .from("activity_intervals")
      .delete()
      .eq("activity_id", activity_id);

    if (deleteErr) throw deleteErr;

    if (manualIntervals.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("activity_intervals")
        .insert(manualIntervals);

      if (insertErr) throw insertErr;
    }

    const reprocessDispatched =
      sanitizedSegments.length > 0 || shouldResetToAuto
        ? await dispatchReprocess(activity_id)
        : false;

    return new Response(
      JSON.stringify({ success: true, reprocess_dispatched: reprocessDispatched }),
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
