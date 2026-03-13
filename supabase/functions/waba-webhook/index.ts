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

    const rawBody = await req.text();
    
    // Request-level dedup: hash the raw body to detect identical payloads
    const payloadHash = await hashPayload(rawBody);
    
    const body = JSON.parse(rawBody);
    console.log("Mabbix webhook received:", rawBody.substring(0, 500));

    const acao = body.acao;
    const hasMensagem = body.mensagem !== undefined;
    const hasSender = body.sender !== undefined;

    // Handle ticket lifecycle events
    if (acao === "closed" || acao === "action_from_user" || (acao === "open" && !hasMensagem)) {
      console.log(`Lifecycle event: ${acao}`);
      return okResponse();
    }

    // Handle message echo (mensagem as object with fromMe)
    if (hasMensagem && !Array.isArray(body.mensagem) && typeof body.mensagem === "object") {
      const msg = body.mensagem;
      
      if (msg.fromMe === true) {
        // When the business sends from phone, sender = recipient (customer) phone
        const recipientPhone = extractPhone(body.sender || msg.participant || "");
        console.log(`Outbound echo detected, recipient phone: ${recipientPhone}, raw sender: ${body.sender}`);
        if (recipientPhone) {
          await disableAIForPhoneConversation(supabase, recipientPhone);
        }
        return okResponse();
      }

      const participantRaw = msg.participant || "";
      const senderBodyRaw = body.sender || "";
      const participantPhone = extractPhone(participantRaw);
      const senderPhone = extractPhone(senderBodyRaw);
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
      // Use the real WhatsApp message ID (wid) - this is deterministic
      const wamid = msg.wid || `obj_${msg.id || payloadHash}`;

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

    // Handle message array format
    if (hasMensagem && Array.isArray(body.mensagem) && hasSender) {
      if (body.fromMe === true) {
        console.log("Outbound message array echo — checking if AI should be disabled");
        const senderPhone = extractPhone(body.sender || "");
        if (senderPhone) {
          await disableAIForPhoneConversation(supabase, senderPhone);
        }
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

      for (let i = 0; i < body.mensagem.length; i++) {
        const msgItem = body.mensagem[i];
        const content = msgItem.text || msgItem.body || "[Mensagem sem texto]";
        const messageType = msgItem.type || "text";
        const mediaUrl = msgItem.fileUrl || null;
        // Deterministic wamid: chamadoId + index (NOT Date.now() which varies between parallel requests)
        const wamid = body.chamadoId 
          ? `mabbix_${body.chamadoId}_${i}` 
          : `mabbix_${payloadHash}_${i}`;

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

async function hashPayload(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
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

  // Single atomic check: try to find existing message by wamid first
  // This is the fast path - if wamid exists, skip immediately
  if (wamid) {
    const { data: existingByWamid } = await supabase
      .from("waba_messages")
      .select("id")
      .eq("wamid", wamid)
      .limit(1);
    if (existingByWamid && existingByWamid.length > 0) {
      console.log(`Duplicate by wamid skipped: ${wamid}`);
      return;
    }
  }

  // Upsert conversation
  // Extract profile photo URL from raw payload
  const profilePhotoUrl = rawPayload?.profilePicUrl || rawPayload?.profilePic || rawPayload?.senderPhoto || null;

  const upsertData: any = {
    phone_number: phoneNumber,
    contact_name: contactName,
    last_message_at: new Date().toISOString(),
    status: "active",
  };
  if (profilePhotoUrl) {
    upsertData.profile_photo_url = profilePhotoUrl;
  }

  const { data: conversation } = await supabase
    .from("waba_conversations")
    .upsert(upsertData, { onConflict: "phone_number" })
    .select()
    .single();

  if (!conversation) {
    console.error("Failed to upsert conversation for", phoneNumber);
    return;
  }

  // ─── Auto-reactivate AI if disabled and last interaction was 30+ minutes ago ───
  if (!conversation.ai_enabled) {
    const lastMsgTime = new Date(conversation.last_message_at || 0).getTime();
    const now = Date.now();
    const minutesSinceLastMsg = (now - lastMsgTime) / (1000 * 60);
    const REACTIVATION_THRESHOLD_MINUTES = 30;

    if (minutesSinceLastMsg >= REACTIVATION_THRESHOLD_MINUTES) {
      await supabase
        .from("waba_conversations")
        .update({ ai_enabled: true, queue_status: "waiting" })
        .eq("id", conversation.id);
      conversation.ai_enabled = true;
      console.log(`AI auto-reactivated for ${phoneNumber} after ${minutesSinceLastMsg.toFixed(0)}min of inactivity`);
    }
  }

  // Insert message - rely on DB unique index as the definitive guard against race conditions
  const { error: insertError } = await supabase.from("waba_messages").insert({
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

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(`DB-level duplicate prevented for wamid: ${wamid}`);
      return;
    }
    console.error("Insert message error:", insertError);
    return;
  }

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

async function disableAIForPhoneConversation(supabase: any, phoneNumber: string) {
  try {
    // Find conversation by phone number where AI is still enabled
    const { data: conv } = await supabase
      .from("waba_conversations")
      .select("id, ai_enabled")
      .eq("phone_number", phoneNumber)
      .eq("ai_enabled", true)
      .limit(1);

    if (conv && conv.length > 0) {
      await supabase
        .from("waba_conversations")
        .update({ ai_enabled: false })
        .eq("id", conv[0].id);

      // Insert system message to log the handover
      await supabase.from("waba_messages").insert({
        conversation_id: conv[0].id,
        direction: "outbound",
        message_type: "system",
        content: "Técnico assumiu pelo telefone — IA desativada automaticamente",
        sender_type: "system",
        status: "delivered",
      });

      console.log(`AI disabled for conversation ${conv[0].id} — human sent from phone`);
    }
  } catch (err) {
    console.error("Error disabling AI for phone conversation:", err);
  }
}
