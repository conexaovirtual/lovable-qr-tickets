import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const statusMessages: Record<string, string> = {
  em_andamento: "🔧 *Atendimento em Andamento*\n\nSeu chamado está sendo atendido por nossa equipe técnica.",
  concluido: "✅ *Atendimento Concluído*\n\nSeu chamado foi concluído com sucesso!",
  pendente: "⏳ *Atendimento Pendente*\n\nSeu chamado está pendente e será retomado em breve.",
};

function formatPhone(contato: string): string | null {
  const digits = contato.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { daily_record_id, new_status, observacao } = await req.json();

    if (!daily_record_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "daily_record_id and new_status are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const messageTemplate = statusMessages[new_status];
    if (!messageTemplate) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `No notification for status: ${new_status}` }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    // Get the daily record with ticket info
    const { data: record, error: recordError } = await supabase
      .from("daily_service_records")
      .select("ticket_id, company_id, titulo, descricao, solucao")
      .eq("id", daily_record_id)
      .single();

    if (recordError || !record) {
      console.error("Daily record not found:", recordError);
      return new Response(
        JSON.stringify({ error: "Daily record not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Try to get contact from the linked ticket
    let phone: string | null = null;
    let contactName: string | null = null;

    if (record.ticket_id) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("solicitante_contato, solicitante_nome, numero")
        .eq("id", record.ticket_id)
        .single();

      if (ticket?.solicitante_contato) {
        phone = formatPhone(ticket.solicitante_contato);
        contactName = ticket.solicitante_nome;
      }
    }

    // Fallback: try company WhatsApp
    if (!phone && record.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("whatsapp, nome_fantasia")
        .eq("id", record.company_id)
        .single();

      if (company?.whatsapp) {
        phone = formatPhone(company.whatsapp);
        contactName = contactName || company.nome_fantasia;
      }
    }

    if (!phone) {
      console.log("No valid phone number found for daily record notification");
      return new Response(
        JSON.stringify({ skipped: true, reason: "No valid phone number found" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build message
    let message = messageTemplate;

    // Add title
    message += `\n\n📋 *Chamado:* ${record.titulo}`;

    // Add company name
    if (record.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("nome_fantasia")
        .eq("id", record.company_id)
        .single();
      if (company) {
        message += `\n🏢 *Empresa:* ${company.nome_fantasia}`;
      }
    }

    // Add solution if concluded
    if (new_status === "concluido" && (observacao || record.solucao)) {
      message += `\n\n📝 *Solução:* ${observacao || record.solucao}`;
    }

    message += "\n\n_Conexão Virtual - Help Desk TI_";

    // Send via Mabbix
    console.log(`Sending daily record notification to ${phone} (status: ${new_status})`);

    const response = await fetch(`${MABBIX_BACKEND_URL}/api/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MABBIX_CONNECTION_TOKEN}`,
      },
      body: JSON.stringify({
        number: phone,
        openTicket: "0",
        queueId: "0",
        body: message,
      }),
    });

    const result = await response.json();
    console.log("Mabbix notification response:", JSON.stringify(result).substring(0, 300));

    return new Response(
      JSON.stringify({ success: true, phone, status: new_status }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("notify-daily-record-status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
