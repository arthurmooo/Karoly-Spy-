import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile || !["admin", "coach"].includes(profile.role) || profile.is_active === false) {
      return jsonResponse({ error: "Coach access required" }, 403);
    }

    // 2. Parse body
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return jsonResponse({ error: "action required" }, 400);
    }

    switch (action) {
      // ── LIST ─────────────────────────────────────────────
      case "list": {
        const { data, error } = await supabaseAdmin
          .from("athlete_groups")
          .select("*")
          .eq("coach_id", user.id)
          .order("sort_order", { ascending: true });

        if (error) throw error;
        return jsonResponse({ success: true, groups: data });
      }

      // ── CREATE ───────────────────────────────────────────
      case "create": {
        const { name, color } = body;
        if (!name) return jsonResponse({ error: "name required" }, 400);

        // Compute next sort_order
        const { data: existing } = await supabaseAdmin
          .from("athlete_groups")
          .select("sort_order")
          .eq("coach_id", user.id)
          .order("sort_order", { ascending: false })
          .limit(1);

        const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

        const { data: created, error } = await supabaseAdmin
          .from("athlete_groups")
          .insert({
            coach_id: user.id,
            name: name.trim(),
            color: color ?? "#64748B",
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ success: true, group: created });
      }

      // ── UPDATE ───────────────────────────────────────────
      case "update": {
        const { group_id, name, color } = body;
        if (!group_id) return jsonResponse({ error: "group_id required" }, 400);

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name !== undefined) updatePayload.name = name.trim();
        if (color !== undefined) updatePayload.color = color;

        const { error } = await supabaseAdmin
          .from("athlete_groups")
          .update(updatePayload)
          .eq("id", group_id)
          .eq("coach_id", user.id);

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      // ── DELETE ───────────────────────────────────────────
      case "delete": {
        const { group_id } = body;
        if (!group_id) return jsonResponse({ error: "group_id required" }, 400);

        // Check athletes assigned
        const { count } = await supabaseAdmin
          .from("athletes")
          .select("id", { count: "exact", head: true })
          .eq("athlete_group_id", group_id);

        if (count && count > 0) {
          return jsonResponse(
            { error: `Impossible de supprimer : ${count} athlète(s) assigné(s) à ce groupe.` },
            409
          );
        }

        const { error } = await supabaseAdmin
          .from("athlete_groups")
          .delete()
          .eq("id", group_id)
          .eq("coach_id", user.id);

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      // ── REORDER ──────────────────────────────────────────
      case "reorder": {
        const { items } = body; // [{id, sort_order}]
        if (!Array.isArray(items)) return jsonResponse({ error: "items array required" }, 400);

        for (const item of items) {
          const { error } = await supabaseAdmin
            .from("athlete_groups")
            .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("coach_id", user.id);
          if (error) throw error;
        }

        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("Error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});
