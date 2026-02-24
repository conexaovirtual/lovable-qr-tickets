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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Mabbix webhook received:", JSON.stringify(body).substring(0, 500));

    // Mabbix webhook payload structure
    // Messages: body contains ticket info + message data
    // Ticket events: body contains ticket status changes
    // Tags: body contains tag changes

    const event = body.event || body.type || detectEvent(body);

    switch (event) {
      case "message":
      case "messages":
      case "received": {
        await handleIncomingMessage(supabase, body);
        break;
      }
      case "ticket_open":
      case "ticket_close":
      case "ticket": {
        console.log("Ticket event:", event, JSON.stringify(body).substring(0, 200));
        break;
      }
      case "tag": {
        console.log("Tag event:", JSON.stringify(body).substring(0, 200));
        break;
      }
      case "status": {
        await handleStatusUpdate(supabase, body);
        break;
      }
      default: {
        // Try to process as message if it has message-like fields
        if (body.msg || body.message || body.body?.msg || body.ticket) {
          await handleIncomingMessage(supabase, body);
        } else {
          console.log("Unknown Mabbix event:", event, JSON.stringify(body).substring(0, 300));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Mabbix webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function detectEvent(body: any): string {
  if (body.msg || body.message || body.body?.msg) return "message";
  if (body.ticket && body.action) return "ticket";
  if (body.tags) return "tag";
  if (body.mediaUrl || body.media) return "message";
  return "unknown";
}

async function handleIncomingMessage(supabase: any, body: any) {
  // Extract data from Mabbix webhook payload
  // Mabbix sends different structures - handle flexibly
  const ticket = body.ticket || body.body?.ticket || {};
  const contact = body.contact || body.body?.contact || ticket.contact || {};
  const msg = body.msg || body.message || body.body?.msg || {};

  // Extract phone number (Mabbix formats: with @s.whatsapp.net or clean)
  let phoneNumber = contact.number || contact.pushname || ticket.contact?.number || body.from || body.number || "";
  phoneNumber = phoneNumber.replace(/@.*$/, "").replace(/\D/g, "");

  if (!phoneNumber) {
    console.log("No phone number found in webhook payload, skipping");
    return;
  }

  const contactName = contact.name || contact.pushname || ticket.contact?.name || "Desconhecido";

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
    return;
  }

  // Extract message content
  let content = "";
  let messageType = "text";
  let mediaUrl = null;

  // Handle Mabbix message structure
  const messageObj = msg.message || msg;
  
  if (typeof messageObj === "string") {
    content = messageObj;
    messageType = "text";
  } else if (messageObj?.conversation) {
    content = messageObj.conversation;
    messageType = "text";
  } else if (messageObj?.extendedTextMessage) {
    content = messageObj.extendedTextMessage?.text || "";
    messageType = "text";
  } else if (messageObj?.imageMessage) {
    content = messageObj.imageMessage?.caption || "[Imagem]";
    messageType = "image";
    mediaUrl = body.mediaUrl || body.media?.url || null;
  } else if (messageObj?.audioMessage) {
    content = "[Áudio]";
    messageType = "audio";
    mediaUrl = body.mediaUrl || body.media?.url || null;
  } else if (messageObj?.videoMessage) {
    content = messageObj.videoMessage?.caption || "[Vídeo]";
    messageType = "video";
    mediaUrl = body.mediaUrl || body.media?.url || null;
  } else if (messageObj?.documentMessage) {
    content = messageObj.documentMessage?.fileName || "[Documento]";
    messageType = "document";
    mediaUrl = body.mediaUrl || body.media?.url || null;
  } else if (messageObj?.stickerMessage) {
    content = "[Sticker]";
    messageType = "sticker";
  } else if (messageObj?.locationMessage) {
    const lat = messageObj.locationMessage?.degreesLatitude;
    const lng = messageObj.locationMessage?.degreesLongitude;
    content = `📍 Lat: ${lat}, Lng: ${lng}`;
    messageType = "location";
  } else if (messageObj?.reactionMessage) {
    content = `[Reação: ${messageObj.reactionMessage?.text || ""}]`;
    messageType = "reaction";
  } else if (messageObj?.contactMessage) {
    content = "[Contato]";
    messageType = "contact";
  } else if (body.body) {
    // Fallback: try body as text
    content = typeof body.body === "string" ? body.body : JSON.stringify(body.body);
    messageType = "text";
  } else {
    content = "[Mensagem não suportada]";
    messageType = "unknown";
  }

  // Determine direction (inbound from client vs outbound from agent)
  const isFromMe = msg.key?.fromMe || body.fromMe || false;
  if (isFromMe) {
    console.log("Outbound message echoed via webhook, skipping save");
    return;
  }

  // Save message
  const wamid = msg.key?.id || msg.id || body.id || null;
  await supabase.from("waba_messages").insert({
    conversation_id: conversation.id,
    wamid: wamid ? String(wamid) : null,
    direction: "inbound",
    message_type: messageType,
    content,
    media_url: mediaUrl,
    status: "received",
    raw_payload: body,
    sender_type: "user",
  });

  console.log(`Message saved from ${phoneNumber}: ${content.substring(0, 50)}`);

  // Trigger AI Agent for text messages
  if (messageType === "text" && content && content !== "[Mensagem não suportada]") {
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
    }
  }
}

async function handleStatusUpdate(supabase: any, body: any) {
  const messageId = body.id || body.messageId || body.wamid;
  const status = body.status || body.ack;
  
  if (messageId && status) {
    const statusMap: Record<string, string> = {
      "1": "sent",
      "2": "delivered",
      "3": "read",
      sent: "sent",
      delivered: "delivered",
      read: "read",
    };

    const mappedStatus = statusMap[String(status)] || String(status);

    await supabase
      .from("waba_messages")
      .update({ status: mappedStatus })
      .eq("wamid", String(messageId));
  }
}
