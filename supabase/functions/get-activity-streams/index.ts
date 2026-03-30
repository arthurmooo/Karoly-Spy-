import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import FitParser from "fit-file-parser";

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

// ---------------------------------------------------------------------------
// Downsampling — port of stream_sampler.py
// Groups 1Hz records into 5-second buckets.
// Mean for hr/power/cadence, last for speed/altitude.
// ---------------------------------------------------------------------------
interface RawRecord {
  elapsed_time?: number;
  timer_time?: number;
  distance?: number;
  heart_rate?: number;
  speed?: number;
  enhanced_speed?: number;
  power?: number;
  cadence?: number;
  altitude?: number;
  enhanced_altitude?: number;
}

interface StreamPoint {
  t: number;
  elapsed_t?: number;
  dist_m?: number;
  hr?: number;
  spd?: number;
  pwr?: number;
  cad?: number;
  alt?: number;
}

function normalizeCadence(value: number | null | undefined, sportType?: string | null): number | undefined {
  if (value == null) return undefined;
  if (sportType?.toLowerCase() === "run") return value * 2;
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ---------------------------------------------------------------------------
// Pause detection — port of stream_sampler.detect_pause_mask
// ---------------------------------------------------------------------------
function detectPauseMask(records: RawRecord[], sportType?: string | null): boolean[] {
  const n = records.length;
  if (n === 0) return [];

  const sport = (sportType ?? "").toLowerCase();
  let threshold: number;
  if (["bike", "cycling", "vtt", "vélo"].includes(sport)) {
    threshold = 1.0;
  } else if (["swim", "natation"].includes(sport)) {
    threshold = 0.25;
  } else {
    threshold = 1.5; // run, ski, default
  }
  const minDuration = 20;

  const mask = new Array<boolean>(n).fill(false);
  let runStart: number | null = null;

  for (let i = 0; i < n; i++) {
    const spd = records[i].enhanced_speed ?? records[i].speed ?? 0;
    const isSlow = spd < threshold;

    if (isSlow) {
      if (runStart === null) runStart = i;
    } else {
      if (runStart !== null) {
        if (i - runStart >= minDuration) {
          for (let j = runStart; j < i; j++) mask[j] = true;
        }
        runStart = null;
      }
    }
  }
  // Trailing run
  if (runStart !== null && n - runStart >= minDuration) {
    for (let j = runStart; j < n; j++) mask[j] = true;
  }

  return mask;
}

function downsampleStreams(
  records: RawRecord[],
  intervalSec = 5,
  sportType?: string | null
): StreamPoint[] {
  if (!records.length) return [];

  // Detect and filter pauses
  const pauseMask = detectPauseMask(records, sportType);
  const activeRecords: RawRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    if (!pauseMask[i]) activeRecords.push(records[i]);
  }

  if (!activeRecords.length) return [];

  // Build raw points — t is cumulative active seconds (not clock-based)
  const raw: {
    t: number;
    elapsed_t: number;
    dist_m: number;
    hr?: number;
    spd?: number;
    pwr?: number;
    cad?: number;
    alt?: number;
  }[] = [];

  let firstRawDistance: number | null = null;
  let reconstructedDistance = 0;
  let previousTimerTime: number | null = null;

  for (let i = 0; i < activeRecords.length; i++) {
    const rec = activeRecords[i];
    const spd = rec.enhanced_speed ?? rec.speed;
    const alt = rec.enhanced_altitude ?? rec.altitude;
    const elapsedT = Number.isFinite(rec.elapsed_time) ? Number(rec.elapsed_time) : i;
    const timerTime = Number.isFinite(rec.timer_time) ? Number(rec.timer_time) : i;
    let distM: number;

    if (isFiniteNumber(rec.distance)) {
      if (firstRawDistance == null) firstRawDistance = rec.distance;
      distM = Math.max(0, rec.distance - firstRawDistance);
    } else {
      const deltaTimer = previousTimerTime == null ? 0 : Math.max(0, timerTime - previousTimerTime);
      reconstructedDistance += (spd != null && spd > 0 ? spd : 0) * deltaTimer;
      distM = reconstructedDistance;
    }
    previousTimerTime = timerTime;

    raw.push({
      t: i, // cumulative active seconds
      elapsed_t: elapsedT,
      dist_m: distM,
      hr: rec.heart_rate ?? undefined,
      spd: spd != null && spd > 0 ? spd : undefined,
      pwr: rec.power != null && rec.power > 0 ? rec.power : undefined,
      cad: normalizeCadence(rec.cadence, sportType),
      alt: alt ?? undefined,
    });
  }

  // Bucket by intervalSec
  const buckets = new Map<
    number,
    {
      elapsedTs: number[];
      dists: number[];
      hrs: number[];
      spds: number[];
      pwrs: number[];
      cads: number[];
      alts: number[];
    }
  >();

  for (const pt of raw) {
    const bucket = Math.floor(pt.t / intervalSec) * intervalSec;
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { elapsedTs: [], dists: [], hrs: [], spds: [], pwrs: [], cads: [], alts: [] });
    }
    const b = buckets.get(bucket)!;
    b.elapsedTs.push(pt.elapsed_t);
    b.dists.push(pt.dist_m);
    if (pt.hr != null) b.hrs.push(pt.hr);
    if (pt.spd != null) b.spds.push(pt.spd);
    if (pt.pwr != null) b.pwrs.push(pt.pwr);
    if (pt.cad != null) b.cads.push(pt.cad);
    if (pt.alt != null) b.alts.push(pt.alt);
  }

  const points: StreamPoint[] = [];
  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

  for (const t of sortedKeys) {
    const b = buckets.get(t)!;
    const pt: StreamPoint = { t };

    if (b.elapsedTs.length) pt.elapsed_t = round1(b.elapsedTs[0]);
    if (b.dists.length) pt.dist_m = round1(b.dists[b.dists.length - 1]);
    if (b.hrs.length) pt.hr = Math.round(mean(b.hrs));
    if (b.spds.length) pt.spd = round2(b.spds[b.spds.length - 1]); // last
    if (b.pwrs.length) pt.pwr = Math.round(mean(b.pwrs));
    if (b.cads.length) pt.cad = Math.round(mean(b.cads));
    if (b.alts.length) pt.alt = round1(b.alts[b.alts.length - 1]); // last

    // Skip empty points
    if (Object.keys(pt).length > 1) {
      points.push(pt);
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Lap serialization — port of serialize_laps
// ---------------------------------------------------------------------------
interface RawLap {
  start_time?: Date | string;
  total_elapsed_time?: number;
  total_timer_time?: number;
  total_distance?: number;
  avg_heart_rate?: number;
  avg_hr?: number;
  enhanced_avg_speed?: number;
  avg_speed?: number;
  avg_power?: number;
  avg_cadence?: number;
  cadence?: number;
  max_heart_rate?: number;
  enhanced_max_speed?: number;
  max_speed?: number;
}

interface SerializedLap {
  lap_n: number;
  start_sec: number;
  duration_sec?: number;
  distance_m?: number;
  avg_hr?: number;
  avg_speed?: number;
  avg_power?: number;
  avg_cadence?: number;
  max_hr?: number;
  max_speed?: number;
}

function serializeLaps(
  laps: RawLap[],
  activityStartTime?: Date | null,
  sportType?: string | null
): SerializedLap[] {
  if (!laps?.length) return [];

  return laps.map((lap, i) => {
    const entry: SerializedLap = { lap_n: i + 1, start_sec: 0 };

    // Start offset
    if (lap.start_time && activityStartTime) {
      try {
        const lapMs =
          typeof lap.start_time === "string"
            ? new Date(lap.start_time).getTime()
            : (lap.start_time as Date).getTime();
        const startMs = activityStartTime.getTime();
        entry.start_sec = Math.round(((lapMs - startMs) / 1000) * 10) / 10;
      } catch {
        entry.start_sec = 0;
      }
    }

    // Duration — prefer total_timer_time (active time) over total_elapsed_time (clock time)
    const dur = lap.total_timer_time ?? lap.total_elapsed_time;
    if (dur != null) entry.duration_sec = round1(dur);

    // Distance
    if (lap.total_distance != null) entry.distance_m = round1(lap.total_distance);

    // Avg HR
    const avgHr = lap.avg_heart_rate ?? lap.avg_hr;
    if (avgHr != null) entry.avg_hr = Math.round(avgHr);

    // Avg Speed — enhanced_avg_speed || avg_speed (project convention)
    const avgSpd = lap.enhanced_avg_speed ?? lap.avg_speed;
    if (avgSpd != null && avgSpd > 0) entry.avg_speed = round3(avgSpd);

    // Avg Power
    if (lap.avg_power != null && lap.avg_power > 0)
      entry.avg_power = Math.round(lap.avg_power);

    // Avg Cadence
    const avgCad = normalizeCadence(lap.avg_cadence ?? lap.cadence, sportType);
    if (avgCad != null) entry.avg_cadence = Math.round(avgCad);

    // Max HR
    if (lap.max_heart_rate != null) entry.max_hr = Math.round(lap.max_heart_rate);

    // Max Speed
    const maxSpd = lap.enhanced_max_speed ?? lap.max_speed;
    if (maxSpd != null && maxSpd > 0) entry.max_speed = round3(maxSpd);

    return entry;
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let activityIdForLog = "unknown";
  try {
    // 1. Validate JWT
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
    const { activity_id } = await req.json();
    activityIdForLog = activity_id ?? "unknown";
    if (!activity_id) {
      return jsonResponse({ error: "activity_id required" }, 400);
    }

    // 3. Load caller profile for authorization
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("role, athlete_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile?.role) {
      return jsonResponse({ error: "User profile not found" }, 403);
    }

    // 4. Query activity
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select(
        "id, athlete_id, fit_file_path, activity_streams, garmin_laps, sport_type, moving_time_sec, athletes!inner(coach_id)"
      )
      .eq("id", activity_id)
      .single();

    if (actErr || !activity) {
      return jsonResponse({ error: "Activity not found" }, 404);
    }

    const athlete = activity.athletes as unknown as { coach_id: string | null };
    if (profile.role === "athlete") {
      if (!profile.athlete_id || activity.athlete_id !== profile.athlete_id) {
        return jsonResponse({ error: "Unauthorized: this activity does not belong to you" }, 403);
      }
    } else if (profile.role === "coach") {
      if (athlete.coach_id && athlete.coach_id !== user.id) {
        return jsonResponse({ error: "Unauthorized: not your athlete" }, 403);
      }
    } else {
      return jsonResponse({ error: "Unauthorized role" }, 403);
    }

    // 5. If already cached, return directly
    const hasElapsedMapping = activity.activity_streams?.some(
      (point: StreamPoint) =>
        typeof point.elapsed_t === "number" && Number.isFinite(point.elapsed_t)
    );
    const hasDistanceMapping = activity.activity_streams?.some(
      (point: StreamPoint) =>
        typeof point.dist_m === "number" && Number.isFinite(point.dist_m)
    );

    if (activity.activity_streams?.length && hasElapsedMapping && hasDistanceMapping) {
      return jsonResponse({
        streams: activity.activity_streams,
        laps: activity.garmin_laps ?? null,
        cached: true,
      });
    }

    // 6. Check fit_file_path exists
    const fitPath = activity.fit_file_path;
    if (!fitPath) {
      return jsonResponse({
        streams: null,
        laps: null,
        reason: "no_fit_file",
      });
    }

    // 7. Download FIT from Storage bucket "raw_fits"
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("raw_fits")
      .download(fitPath);

    if (dlErr || !fileData) {
      console.error("FIT download error:", dlErr?.message, "path:", fitPath);
      return jsonResponse(
        { error: `FIT download failed: ${dlErr?.message ?? "unknown"}` },
        500
      );
    }

    // 8. Parse FIT (with 8s timeout to avoid hanging on corrupt files)
    const arrayBuffer = await fileData.arrayBuffer();
    const fitParser = new FitParser({
      force: true,
      speedUnit: "m/s",
      lengthUnit: "m",
      elapsedRecordField: true,
      mode: "list",
    });

    const parsed = await Promise.race([
      new Promise<{ records: RawRecord[]; laps: RawLap[]; sessions: unknown[] }>(
        (resolve, reject) => {
          fitParser.parse(Buffer.from(arrayBuffer), (error: unknown, data: {
            records?: RawRecord[];
            laps?: RawLap[];
            sessions?: unknown[];
          }) => {
            if (error) reject(error);
            else
              resolve({
                records: data.records ?? [],
                laps: data.laps ?? [],
                sessions: data.sessions ?? [],
              });
          });
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FIT parsing timeout (8s)")), 8000)
      ),
    ]);

    // 9. Downsample streams (1Hz → 5s)
    const streams = downsampleStreams(parsed.records, 5, activity.sport_type);

    // 10. Serialize laps
    // Try to get activity start time from first record or first session
    let startTime: Date | null = null;
    if (parsed.records.length > 0) {
      const firstRec = parsed.records[0] as Record<string, unknown>;
      if (firstRec.timestamp) {
        startTime = new Date(firstRec.timestamp as string | number);
      }
    }
    const laps = serializeLaps(parsed.laps, startTime, activity.sport_type);

    // 11. Cache in DB (fire-and-forget, don't block response)
    // Also opportunistically backfill moving_time_sec if NULL
    const updatePayload: Record<string, unknown> = {};
    if (streams.length) updatePayload.activity_streams = streams;
    if (laps.length) updatePayload.garmin_laps = laps;

    // Backfill moving_time_sec: count non-paused seconds
    if (activity.moving_time_sec == null && parsed.records.length > 0) {
      const pauseMask = detectPauseMask(parsed.records, activity.sport_type);
      const activeCount = pauseMask.filter((p) => !p).length;
      if (activeCount > 0) {
        updatePayload.moving_time_sec = activeCount;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      supabaseAdmin
        .from("activities")
        .update(updatePayload)
        .eq("id", activity_id)
        .then(({ error: upErr }) => {
          if (upErr) console.error("Cache update failed:", upErr.message);
          else console.log(`Cached streams for activity ${activity_id}: ${streams.length} points, ${laps.length} laps`);
        });
    }

    return jsonResponse({
      streams: streams.length ? streams : null,
      laps: laps.length ? laps : null,
      cached: false,
    });
  } catch (err) {
    const e = err as Error;
    console.error(`Error for activity ${activityIdForLog}:`, e.message, e.stack);
    return jsonResponse({
      streams: null,
      laps: null,
      error: "FIT file could not be parsed. Streams will be available after the next robot run.",
    }, 200); // Return 200 with null data instead of 500 to avoid UI crash
  }
});
