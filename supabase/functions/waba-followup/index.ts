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

    const MABBIX_BACKEND_URL = Deno.env.get("MABBIX_BACKEND_URL");
    const MABBIX_CONNECTION_TOKEN = Deno.env.get("MABBIX_CONNECTION_TOKEN");

    if (!MABBIX_BACKEND_URL || !MABBIX_CONNECTION_TOKEN) {
      throw new Error("Mabbix API not configured");
    }

    const results = { followups_sent: 0, resolutions_sent: 0, errors: 0 };

    // ─── 1. Follow-up for tickets created via WhatsApp (2h+ ago, no update) ───
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Find tickets created via WhatsApp channel, still open, created 2-4h ago
    const { data: pendingTickets } = await supabase
      .from("tickets")
      .select("id, numero, titulo, company_id, solicitante_nome, canal, created_at")
      .eq("canal", "whatsapp")
      .in("status", ["novo", "em_atendimento"])
      .lte("created_at", twoHoursAgo)
      .gte("created_at", fourHoursAgo);

    for (const ticket of (pendingTickets || [])) {
      try {
        // Find the WhatsApp contact linked to this company
        const phone = await findCompanyWhatsAppContact(supabase, ticket.company_id);
        if (!phone) continue;

        // Check if we already sent a follow-up for this ticket (avoid spam)
        const { data: recentFollowup } = await supabase
          .from("waba_messages")
          .select("id")
          .ilike("content", `%chamado #${ticket.numero}%`)
          .ilike("content", `%novidade%`)
          .eq("direction", "outbound")
          .eq("sender_type", "ai")
          .gte("created_at", fourHoursAgo)
          .maybeSingle();

        if (recentFollowup) continue;

        const contactName = ticket.solicitante_nome || "cliente";
        const message = `Oi ${contactName}! Passando pra saber se teve alguma novidade sobre o problema do chamado #${ticket.numero}. Precisa de mais alguma coisa?`;

        await sendMessage(phone, message, MABBIX_BACKEND_URL, MABBIX_CONNECTION_TOKEN);
        await saveFollowupMessage(supabase, phone, message);
        results.followups_sent++;
        console.log(`Follow-up sent for ticket #${ticket.numero} to ${phone}`);
      } catch (err) {
        console.error(`Follow-up error for ticket #${ticket.numero}:`, err);
        results.errors++;
      }
    }

    // ─── 2. Resolution notifications (tickets resolved, notify client) ───
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: resolvedTickets } = await supabase
      .from("tickets")
      .select("id, numero, titulo, company_id, solicitante_nome, canal, data_solucao")
      .eq("canal", "whatsapp")
      .eq("status", "resolvido")
      .gte("data_solucao", oneHourAgo);

    for (const ticket of (resolvedTickets || [])) {
      try {
        const phone = await findCompanyWhatsAppContact(supabase, ticket.company_id);
        if (!phone) continue;

        // Check if resolution notification already sent
        const { data: alreadyNotified } = await supabase
          .from("waba_messages")
          .select("id")
          .ilike("content", `%chamado #${ticket.numero}%resolvido%`)
          .eq("direction", "outbound")
          .eq("sender_type", "ai")
          .gte("created_at", oneHourAgo)
          .maybeSingle();

        if (alreadyNotified) continue;

        const contactName = ticket.solicitante_nome || "cliente";
        const message = `Oi ${contactName}! Seu chamado #${ticket.numero} foi resolvido pela equipe. Pode confirmar se tá tudo certo pra gente? Se precisar de mais alguma coisa, é só falar 😊`;

        await sendMessage(phone, message, MABBIX_BACKEND_URL, MABBIX_CONNECTION_TOKEN);
        await saveFollowupMessage(supabase, phone, message);
        results.resolutions_sent++;
        console.log(`Resolution notification sent for ticket #${ticket.numero} to ${phone}`);
      } catch (err) {
        console.error(`Resolution notification error for ticket #${ticket.numero}:`, err);
        results.errors++;
      }
    }

    console.log("Follow-up results:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Follow-up error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function findCompanyWhatsAppContact(supabase: any, companyId: string): Promise<string | null> {
  // First try whatsapp_contacts table
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("phone_number")
    .eq("company_id", companyId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contact?.phone_number) return contact.phone_number;

  // Fallback: check company's whatsapp field
  const { data: company } = await supabase
    .from("companies")
    .select("whatsapp")
    .eq("id", companyId)
    .maybeSingle();

  if (company?.whatsapp) {
    return company.whatsapp.replace(/\D/g, "");
  }

  return null;
}

async function sendMessage(phone: string, text: string, mabbixUrl: string, mabbixToken: string) {
  const response = await fetch(`${mabbixUrl}/api/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mabbixToken}`,
    },
    body: JSON.stringify({
      number: phone,
      openTicket: "0",
      queueId: "0",
      body: text,
    }),
  });

  const result = await response.json();
  console.log("Followup message sent:", JSON.stringify(result).substring(0, 200));
  return result;
}

async function saveFollowupMessage(supabase: any, phone: string, text: string) {
  // Find or create conversation
  const { data: conversation } = await supabase
    .from("waba_conversations")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();

  if (conversation) {
    await supabase.from("waba_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      message_type: "text",
      content: text,
      status: "sent",
      sender_type: "ai",
    });

    await supabase
      .from("waba_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);
  }
}
