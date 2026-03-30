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
    // Verify service role key auth
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const expectedToken = `Bearer ${serviceRoleKey}`;

    if (!authHeader || authHeader !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { total_gb, limit_gb, pct, status } = await req.json();

    if (!status || !["warning", "critical"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "status must be 'warning' or 'critical'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-spam: check last email sent date
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    const { data: monitorRow } = await supabaseAdmin
      .from("system_monitoring")
      .select("details")
      .eq("key", "storage_raw_fits")
      .single();

    const details = (monitorRow?.details ?? {}) as Record<string, unknown>;
    const lastEmailSent = details.last_email_sent as string | undefined;

    if (lastEmailSent) {
      const daysSinceLast =
        (Date.now() - new Date(lastEmailSent).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 7) {
        return new Response(
          JSON.stringify({
            sent: false,
            reason: `cooldown: last email sent ${daysSinceLast.toFixed(1)} days ago`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const recipientEmail = Deno.env.get("STORAGE_ALERT_EMAIL");

    if (!resendApiKey || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY or STORAGE_ALERT_EMAIL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabel = status === "critical" ? "CRITIQUE" : "ATTENTION";
    const subject = `[KS Endurance] ${statusLabel} — Stockage FIT à ${pct}%`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${status === "critical" ? "#dc2626" : "#f97316"};">
          ${statusLabel} — Stockage FIT
        </h2>
        <p>Votre espace de stockage des fichiers FIT utilise actuellement
          <strong>${pct}%</strong> de la capacité disponible.</p>
        <p style="font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0;">
          ${total_gb.toFixed(1)} GB / ${limit_gb} GB
        </p>
        <p>Si le stockage atteint 100%, les nouvelles séances ne pourront plus être sauvegardées.</p>
        <p><strong>Action recommandée :</strong> contactez votre administrateur pour
          ${status === "critical"
            ? "libérer de l'espace ou augmenter la capacité immédiatement."
            : "planifier un nettoyage des fichiers anciens."}
        </p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="font-size: 12px; color: #94a3b8;">
          Cet email est envoyé automatiquement par la plateforme KS Endurance Training.
          Prochain contrôle dans 7 jours si le problème persiste.
        </p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "KS Endurance <onboarding@resend.dev>",
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend API error:", resendRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_email_sent timestamp
    const updatedDetails = { ...details, last_email_sent: new Date().toISOString() };
    await supabaseAdmin
      .from("system_monitoring")
      .update({ details: updatedDetails })
      .eq("key", "storage_raw_fits");

    const resendData = await resendRes.json();
    return new Response(
      JSON.stringify({ sent: true, email_id: resendData.id }),
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
