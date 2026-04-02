import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getRedirectTo(req: Request, explicitRedirectTo: unknown) {
  if (typeof explicitRedirectTo === "string" && explicitRedirectTo.trim()) {
    return explicitRedirectTo.trim();
  }

  const origin = req.headers.get("origin");
  if (origin) {
    return `${origin.replace(/\/$/, "")}/accept-invite`;
  }

  const fallback = Deno.env.get("APP_SITE_URL");
  if (fallback) {
    return `${fallback.replace(/\/$/, "")}/accept-invite`;
  }

  return undefined;
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

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("role, structure_id, is_active")
      .eq("id", user.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerProfile.role !== "admin" || callerProfile.is_active === false || !callerProfile.structure_id) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, display_name, redirect_to } = await req.json();
    if (!email || !display_name) {
      return new Response(JSON.stringify({ error: "email and display_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const redirectTo = getRedirectTo(req, redirect_to);

    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("id, role, structure_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile && existingProfile.structure_id && existingProfile.structure_id !== callerProfile.structure_id) {
      return new Response(JSON.stringify({ error: "This email belongs to another structure" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingProfile && !["admin", "coach"].includes(existingProfile.role)) {
      return new Response(JSON.stringify({ error: "This email is already used by another account type" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: { role: "coach" },
      }
    );

    if (inviteErr) {
      if (inviteErr.message?.includes("already been registered")) {
        return new Response(JSON.stringify({ success: true, already_registered: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw inviteErr;
    }

    if (inviteData?.user) {
      await supabaseAdmin.from("user_profiles").upsert({
        id: inviteData.user.id,
        role: "coach",
        display_name: String(display_name).trim(),
        email: normalizedEmail,
        structure_id: callerProfile.structure_id,
        is_active: true,
      });
    }

    return new Response(JSON.stringify({ success: true, email: normalizedEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
