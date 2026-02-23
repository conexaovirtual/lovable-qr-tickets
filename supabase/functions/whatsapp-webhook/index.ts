import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    console.log("WhatsApp webhook received:", JSON.stringify(body).substring(0, 500));

    const event = body.event;

    // Handle incoming messages
    if (event === "messages.upsert") {
      const data = body.data;
      if (!data) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

      const key = data.key;
      const message = data.message;
      const pushName = data.pushName || "Desconhecido";
      const remoteJid = key?.remoteJid;
      const fromMe = key?.fromMe || false;

      // Skip messages sent by us
      if (fromMe) {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Extract phone number from remoteJid (format: 5511999999999@s.whatsapp.net)
      const phoneNumber = remoteJid?.replace("@s.whatsapp.net", "").replace("@g.us", "") || "";
      
      // Extract message content
      let content = "";
      let messageType = "text";
      if (message?.conversation) {
        content = message.conversation;
      } else if (message?.extendedTextMessage?.text) {
        content = message.extendedTextMessage.text;
      } else if (message?.imageMessage) {
        content = message.imageMessage.caption || "[Imagem]";
        messageType = "image";
      } else if (message?.documentMessage) {
        content = message.documentMessage.fileName || "[Documento]";
        messageType = "document";
      } else if (message?.audioMessage) {
        content = "[Áudio]";
        messageType = "audio";
      } else if (message?.videoMessage) {
        content = message.videoMessage.caption || "[Vídeo]";
        messageType = "video";
      }

      if (!content && messageType === "text") {
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Upsert contact
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .upsert(
          {
            phone_number: phoneNumber,
            contact_name: pushName,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "phone_number" }
        )
        .select()
        .single();

      // Get WhatsApp config
      const { data: config } = await supabase
        .from("whatsapp_config")
        .select("*")
        .limit(1)
        .single();

      // Check if there's an open ticket for this contact
      let ticketId: string | null = null;
      const { data: existingMessages } = await supabase
        .from("whatsapp_messages")
        .select("ticket_id")
        .eq("remote_jid", remoteJid)
        .not("ticket_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingMessages && existingMessages.length > 0) {
        // Check if the linked ticket is still open
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id, status")
          .eq("id", existingMessages[0].ticket_id)
          .single();

        if (ticket && !["fechado", "resolvido"].includes(ticket.status || "")) {
          ticketId = ticket.id;
        }
      }

      // Auto-create ticket if enabled and no open ticket exists
      if (!ticketId && config?.auto_create_ticket) {
        // Try to find company by contact
        const companyId = contact?.company_id;

        if (companyId) {
          const { data: newTicket } = await supabase
            .from("tickets")
            .insert({
              titulo: `WhatsApp: ${content.substring(0, 80)}`,
              descricao: `Mensagem recebida via WhatsApp de ${pushName} (${phoneNumber}):\n\n${content}`,
              company_id: companyId,
              canal: "whatsapp",
              solicitante_nome: pushName,
              solicitante_contato: phoneNumber,
              status: "novo",
              impacto: "medio",
              urgencia: "media",
            })
            .select()
            .single();

          if (newTicket) {
            ticketId = newTicket.id;
            console.log("Ticket criado automaticamente:", newTicket.id);

            // Send auto-response
            if (config?.default_greeting) {
              await sendWhatsAppMessage(phoneNumber, config.default_greeting, config.instance_name);
            }
          }
        } else {
          // No company mapped - send message asking to identify
          await sendWhatsAppMessage(
            phoneNumber,
            `Olá ${pushName}! Recebemos sua mensagem. Para abrir um chamado, por favor informe o nome da sua empresa.`,
            config?.instance_name || ""
          );
        }
      }

      // Save message
      await supabase.from("whatsapp_messages").insert({
        remote_jid: remoteJid,
        message_id: key?.id,
        from_me: false,
        message_type: messageType,
        content,
        ticket_id: ticketId,
        contact_id: contact?.id,
        raw_data: body,
      });

      // If ticket exists and already has a technician, add as comment
      if (ticketId) {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("tecnico_id")
          .eq("id", ticketId)
          .single();

        if (ticket?.tecnico_id) {
          await supabase.from("ticket_comments").insert({
            ticket_id: ticketId,
            user_id: ticket.tecnico_id,
            comentario: `📱 Mensagem WhatsApp de ${pushName}: ${content}`,
            is_internal: false,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function sendWhatsAppMessage(phone: string, text: string, instanceName: string) {
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !instanceName) {
    console.error("Evolution API not configured");
    return;
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: phone,
          text,
        }),
      }
    );

    const result = await response.json();
    console.log("Message sent:", result);
    return result;
  } catch (err) {
    console.error("Error sending WhatsApp message:", err);
  }
}
