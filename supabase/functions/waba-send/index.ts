import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Business API not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();
    console.log("WABA send action:", action);

    switch (action) {
      case "send_text": {
        const { phone, text, conversation_id } = params;

        // Send via Meta Graph API
        const response = await fetch(
          `${GRAPH_API_URL}/${PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: { body: text },
            }),
          }
        );

        const result = await response.json();
        console.log("Meta API response:", JSON.stringify(result));

        if (result.messages && result.messages[0]) {
          // Save outbound message to DB
          await supabase.from("waba_messages").insert({
            conversation_id,
            wamid: result.messages[0].id,
            direction: "outbound",
            message_type: "text",
            content: text,
            status: "sent",
            sender_type: "agent",
          });

          // Update conversation last_message_at
          await supabase
            .from("waba_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversation_id);
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      case "send_template": {
        const { phone, template_name, language_code, components, conversation_id } = params;

        const response = await fetch(
          `${GRAPH_API_URL}/${PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "template",
              template: {
                name: template_name,
                language: { code: language_code || "pt_BR" },
                components: components || [],
              },
            }),
          }
        );

        const result = await response.json();

        if (result.messages && result.messages[0]) {
          await supabase.from("waba_messages").insert({
            conversation_id,
            wamid: result.messages[0].id,
            direction: "outbound",
            message_type: "template",
            content: `[Template: ${template_name}]`,
            status: "sent",
          });
        }

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
    console.error("WABA send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
