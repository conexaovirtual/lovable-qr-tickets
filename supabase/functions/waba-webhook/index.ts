import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("WABA webhook received:", JSON.stringify(body).substring(0, 500));

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        // Process incoming messages
        for (const msg of messages) {
          const contact = contacts.find((c: any) => c.wa_id === msg.from);
          const contactName = contact?.profile?.name || "Desconhecido";
          const phoneNumber = msg.from;

          // Upsert conversation
          const { data: conversation } = await supabase
            .from("waba_conversations")
            .upsert(
              {
                phone_number: phoneNumber,
                contact_name: contactName,
                last_message_at: new Date().toISOString(),
                status: "active",
              },
              { onConflict: "phone_number" }
            )
            .select()
            .single();

          if (!conversation) {
            console.error("Failed to upsert conversation for", phoneNumber);
            continue;
          }

          // Extract message content
          let content = "";
          let messageType = "text";
          let mediaUrl = null;

          switch (msg.type) {
            case "text":
              content = msg.text?.body || "";
              messageType = "text";
              break;
            case "image":
              content = msg.image?.caption || "[Imagem]";
              messageType = "image";
              mediaUrl = msg.image?.id;
              break;
            case "audio":
              content = "[Áudio]";
              messageType = "audio";
              mediaUrl = msg.audio?.id;
              break;
            case "video":
              content = msg.video?.caption || "[Vídeo]";
              messageType = "video";
              mediaUrl = msg.video?.id;
              break;
            case "document":
              content = msg.document?.filename || "[Documento]";
              messageType = "document";
              mediaUrl = msg.document?.id;
              break;
            case "sticker":
              content = "[Sticker]";
              messageType = "sticker";
              break;
            case "location":
              content = `📍 Lat: ${msg.location?.latitude}, Lng: ${msg.location?.longitude}`;
              messageType = "location";
              break;
            default:
              content = `[${msg.type}]`;
              messageType = msg.type;
          }

          // Save message
          await supabase.from("waba_messages").insert({
            conversation_id: conversation.id,
            wamid: msg.id,
            direction: "inbound",
            message_type: messageType,
            content,
            media_url: mediaUrl,
            status: "received",
            raw_payload: msg,
            sender_type: "user",
          });

          console.log(`Message saved from ${phoneNumber}: ${content.substring(0, 50)}`);

          // Trigger AI Agent for text messages
          if (messageType === "text" && content) {
            try {
              const aiResponse = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/waba-ai-agent`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    conversation_id: conversation.id,
                    message_content: content,
                    phone_number: phoneNumber,
                  }),
                }
              );
              const aiResult = await aiResponse.json();
              console.log("AI Agent result:", JSON.stringify(aiResult).substring(0, 200));
            } catch (aiErr) {
              console.error("AI Agent invocation failed:", aiErr);
              // Don't fail the webhook if AI fails
            }
          }
        }

        // Process message status updates
        for (const statusUpdate of statuses) {
          if (statusUpdate.id) {
            await supabase
              .from("waba_messages")
              .update({ status: statusUpdate.status })
              .eq("wamid", statusUpdate.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("WABA webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
