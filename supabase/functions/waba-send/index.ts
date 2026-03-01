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
    const MABBIX_BACKEND_URL = Deno.env.get("MABBIX_BACKEND_URL");
    const MABBIX_CONNECTION_TOKEN = Deno.env.get("MABBIX_CONNECTION_TOKEN");

    if (!MABBIX_BACKEND_URL || !MABBIX_CONNECTION_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Mabbix API not configured" }),
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

        // Send via Mabbix API
        const response = await fetch(
          `${MABBIX_BACKEND_URL}/api/messages/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${MABBIX_CONNECTION_TOKEN}`,
            },
            body: JSON.stringify({
              number: phone,
              openTicket: "0",
              queueId: "0",
              body: text,
            }),
          }
        );

        const result = await response.json();
        console.log("Mabbix API response:", JSON.stringify(result).substring(0, 300));

        // Save outbound message to DB
        const messageId = result?.id || result?.message?.id || null;
        await supabase.from("waba_messages").insert({
          conversation_id,
          wamid: messageId ? String(messageId) : null,
          direction: "outbound",
          message_type: "text",
          content: text,
          status: "sent",
          sender_type: "agent",
        });

        // Update conversation: last_message, first_response, queue_status
        const { data: conv } = await supabase
          .from("waba_conversations")
          .select("first_response_at, queue_status")
          .eq("id", conversation_id)
          .single();

        const updates: any = { last_message_at: new Date().toISOString() };
        if (!conv?.first_response_at) {
          updates.first_response_at = new Date().toISOString();
        }
        if (conv?.queue_status === "waiting") {
          updates.queue_status = "assigned";
        }

        await supabase
          .from("waba_conversations")
          .update(updates)
          .eq("id", conversation_id);

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      case "send_audio": {
        const { phone, audio_base64, conversation_id } = params;

        // Send audio via Mabbix API
        const response = await fetch(
          `${MABBIX_BACKEND_URL}/api/messages/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${MABBIX_CONNECTION_TOKEN}`,
            },
            body: JSON.stringify({
              number: phone,
              openTicket: "0",
              queueId: "0",
              body: audio_base64,
              isAudio: true,
            }),
          }
        );

        const result = await response.json();
        console.log("Mabbix audio response:", JSON.stringify(result).substring(0, 300));

        // Save outbound audio message to DB
        const messageId = result?.id || result?.message?.id || null;
        await supabase.from("waba_messages").insert({
          conversation_id,
          wamid: messageId ? String(messageId) : null,
          direction: "outbound",
          message_type: "audio",
          content: "[Mensagem de áudio]",
          status: "sent",
          sender_type: "agent",
        });

        // Update conversation timestamps
        const { data: conv } = await supabase
          .from("waba_conversations")
          .select("first_response_at, queue_status")
          .eq("id", conversation_id)
          .single();

        const updates: any = { last_message_at: new Date().toISOString() };
        if (!conv?.first_response_at) {
          updates.first_response_at = new Date().toISOString();
        }
        if (conv?.queue_status === "waiting") {
          updates.queue_status = "assigned";
        }

        await supabase
          .from("waba_conversations")
          .update(updates)
          .eq("id", conversation_id);

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
