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

    // Mabbix sends two main payload formats:
    // 1. With "mensagem" array + "sender" + "acao" + "name" (webhook de fluxo/chatbot)
    // 2. With "mensagem" object (echo de mensagem individual com body, mediaUrl, fromMe etc)

    const acao = body.acao;
    const hasMensagem = body.mensagem !== undefined;
    const hasSender = body.sender !== undefined;

    // Handle ticket lifecycle events
    if (acao === "closed") {
      console.log("Ticket closed event for chamado:", body.chamadoId);
      return okResponse();
    }

    if (acao === "action_from_user") {
      console.log("Action from user event for chamado:", body.chamadoId);
      return okResponse();
    }

    if (acao === "open" && !hasMensagem) {
      console.log("Ticket opened event for chamado:", body.chamadoId);
      return okResponse();
    }

    // Handle message echo (mensagem as object with fromMe)
    if (hasMensagem && !Array.isArray(body.mensagem) && typeof body.mensagem === "object") {
      const msg = body.mensagem;
      
      // Skip outbound echoes
      if (msg.fromMe === true) {
        console.log("Outbound message echo, skipping");
        return okResponse();
      }

      // Inbound message as object format
      const participantRaw = msg.participant || "";
      const senderBodyRaw = body.sender || "";
      // Prefer body.sender (real phone) over msg.participant (may be LID)
      const participantPhone = extractPhone(participantRaw);
      const senderPhone = extractPhone(senderBodyRaw);
      // Use sender if participant looks like a LID (too long or starts with unusual prefix)
      const phoneNumber = (senderPhone && senderPhone.length >= 10 && senderPhone.length <= 15) 
        ? senderPhone 
        : (participantPhone && participantPhone.length >= 10 && participantPhone.length <= 15)
          ? participantPhone
          : senderPhone || participantPhone;
      if (!phoneNumber) {
        console.log("No valid phone in message object payload, skipping");
        return okResponse();
      }

      const contactName = body.name || "Desconhecido";
      const content = msg.body || "[Mensagem sem texto]";
      const messageType = detectMessageType(msg.mediaType, msg.mediaUrl);
      const mediaUrl = msg.mediaUrl || null;
      const wamid = msg.wid || String(msg.id || "");

      await saveInboundMessage(supabase, {
        phoneNumber,
        contactName,
        content,
        messageType,
        mediaUrl,
        wamid,
        rawPayload: body,
        isGroup: isGroupChat(senderBodyRaw || participantRaw),
      });

      return okResponse();
    }

    // Handle message array format (main webhook format)
    if (hasMensagem && Array.isArray(body.mensagem) && hasSender) {
      // Skip outbound
      if (body.fromMe === true) {
        console.log("Outbound message array, skipping");
        return okResponse();
      }

      const senderRaw = body.sender;
      const phoneNumber = extractPhone(senderRaw);
      if (!phoneNumber) {
        console.log("No phone in array payload, skipping");
        return okResponse();
      }
      const groupFlag = isGroupChat(senderRaw);

      const contactName = body.name || "Desconhecido";

      // Process each message in the array
      for (const msgItem of body.mensagem) {
        const content = msgItem.text || msgItem.body || "[Mensagem sem texto]";
        const messageType = msgItem.type || "text";
        const mediaUrl = msgItem.fileUrl || null;
        const wamid = body.chamadoId ? `mabbix_${body.chamadoId}_${Date.now()}` : `mabbix_${Date.now()}`;

        await saveInboundMessage(supabase, {
          phoneNumber,
          contactName,
          content,
          messageType,
          mediaUrl,
          wamid,
          rawPayload: body,
          isGroup: groupFlag,
        });
      }

      return okResponse();
    }

    console.log("Unhandled Mabbix payload structure, acao:", acao);
    return okResponse();
  } catch (error: any) {
    console.error("Mabbix webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function extractPhone(raw: string): string {
  return raw.replace(/@.*$/, "").replace(/\D/g, "");
}

function isGroupChat(raw: string): boolean {
  return raw.includes("@g.us");
}

function detectMessageType(mediaType?: string, mediaUrl?: string): string {
  if (!mediaType && !mediaUrl) return "text";
  if (mediaType?.includes("image") || mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i)) return "image";
  if (mediaType?.includes("audio")) return "audio";
  if (mediaType?.includes("video")) return "video";
  if (mediaType?.includes("document") || mediaType?.includes("application")) return "document";
  if (mediaType === "conversation" || mediaType === "extendedTextMessage") return "text";
  return mediaUrl ? "document" : "text";
}

interface InboundMessageData {
  phoneNumber: string;
  contactName: string;
  content: string;
  messageType: string;
  mediaUrl: string | null;
  wamid: string;
  rawPayload: any;
  isGroup: boolean;
}

async function saveInboundMessage(supabase: any, data: InboundMessageData) {
  const { phoneNumber, contactName, content, messageType, mediaUrl, wamid, rawPayload, isGroup } = data;

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

  // Save message
  await supabase.from("waba_messages").insert({
    conversation_id: conversation.id,
    wamid: wamid || null,
    direction: "inbound",
    message_type: messageType,
    content,
    media_url: mediaUrl,
    status: "received",
    raw_payload: rawPayload,
    sender_type: "user",
  });

  console.log(`Message saved from ${phoneNumber}: ${content.substring(0, 80)}`);

    // Trigger AI Agent for text and audio messages
    const shouldTriggerAI = (messageType === "text" && content && content !== "[Mensagem sem texto]") || messageType === "audio";
    if (shouldTriggerAI) {
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
              is_group: isGroup,
              media_url: mediaUrl,
              message_type: messageType,
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
