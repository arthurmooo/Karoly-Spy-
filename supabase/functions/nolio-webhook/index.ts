import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const NOLIO_VERIFICATION_KEY = "qP9IeKoMYb";

Deno.serve(async (req) => {
  // 1. Vérification de la sécurité
  const nolioKey = req.headers.get("http-x-nolio-key");
  
  if (nolioKey !== NOLIO_VERIFICATION_KEY) {
    console.error("Unauthorized: Invalid Nolio Key");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" } 
    });
  }

  try {
    const payload = await req.json();
    console.log("Received Nolio Webhook:", payload);

    // 2. Initialisation du client Supabase (interne)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Stockage de l'événement pour traitement ultérieur par le robot
    const { error } = await supabase
      .from('webhook_events')
      .insert([
        { 
          provider: 'nolio',
          payload: payload
        }
      ]);

    if (error) throw error;

    return new Response(JSON.stringify({ message: "OK" }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("Error processing webhook:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
});
