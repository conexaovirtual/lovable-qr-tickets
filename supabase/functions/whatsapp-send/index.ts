import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { action, ...params } = await req.json();
    console.log("WhatsApp send action:", action);

    switch (action) {
      case "send_text": {
        const { phone, text, instance_name } = params;
        const response = await fetch(
          `${EVOLUTION_API_URL}/message/sendText/${instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({ number: phone, text }),
          }
        );
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      case "check_status": {
        const { instance_name } = params;
        const response = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${instance_name}`,
          { headers: { apikey: EVOLUTION_API_KEY } }
        );
        const result = await response.json();
        console.log("Connection state result:", JSON.stringify(result));
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      case "set_webhook": {
        const { instance_name, webhook_url } = params;
        const response = await fetch(
          `${EVOLUTION_API_URL}/webhook/set/${instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              url: webhook_url,
              webhook_by_events: false,
              webhook_base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            }),
          }
        );
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      case "fetch_instances": {
        const response = await fetch(
          `${EVOLUTION_API_URL}/instance/fetchInstances`,
          { headers: { apikey: EVOLUTION_API_KEY } }
        );
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }
  } catch (error: any) {
    console.error("WhatsApp send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
