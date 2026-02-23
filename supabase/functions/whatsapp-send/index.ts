import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth validation failed:", userError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log("Authenticated user:", user.id);

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    if (!EVOLUTION_API_URL) {
      return new Response(JSON.stringify({ error: "EVOLUTION_API_URL not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "EVOLUTION_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { action, ...params } = await req.json();

    // Route actions
    switch (action) {
      case "send_text": {
        const { phone, text, instance_name } = params;
        const response = await fetch(
          `${EVOLUTION_API_URL}/message/sendText/${instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
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
          {
            headers: { apikey: EVOLUTION_API_KEY },
          }
        );
        const result = await response.json();
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
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              url: webhook_url,
              webhook_by_events: false,
              webhook_base64: false,
              events: [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
              ],
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
          {
            headers: { apikey: EVOLUTION_API_KEY },
          }
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
