import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const statusMessages: Record<string, string> = {
  confirmada: "✅ *Ordem de Serviço Confirmada*\n\nSua OS #{numero_os} foi confirmada pelo técnico e será atendida em breve.",
  em_execucao: "🔧 *Atendimento Iniciado*\n\nO técnico iniciou o atendimento da sua OS #{numero_os}. Acompanharemos você até a conclusão.",
  executada: "📋 *Atendimento Realizado*\n\nO atendimento da OS #{numero_os} foi concluído. Estamos finalizando os registros.",
  finalizada: "🎉 *Ordem de Serviço Finalizada*\n\nSua OS #{numero_os} foi finalizada com sucesso! Se precisar de algo mais, estamos à disposição.",
  cancelada: "❌ *Ordem de Serviço Cancelada*\n\nA OS #{numero_os} foi cancelada. Se tiver dúvidas, entre em contato conosco.",
};

function formatPhone(contato: string): string | null {
  // Extract digits only
  const digits = contato.replace(/\D/g, "");

  // Must have at least 10 digits (DDD + number) to be a phone
  if (digits.length < 10) return null;

  // If already starts with 55, use as-is; otherwise prepend 55
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  return `55${digits}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { service_order_id, new_status, observacao } = await req.json();

    if (!service_order_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "service_order_id and new_status are required" }),
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

    // Get the service order with ticket info
    const { data: so, error: soError } = await supabase
      .from("service_orders")
      .select("numero_os, ticket_id, company_id, descricao_servicos")
      .eq("id", service_order_id)
      .single();

    if (soError || !so) {
      console.error("OS not found:", soError);
      return new Response(
        JSON.stringify({ error: "Service order not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Try to get contact from the linked ticket
    let phone: string | null = null;
    let contactName: string | null = null;

    if (so.ticket_id) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("solicitante_contato, solicitante_nome")
        .eq("id", so.ticket_id)
        .single();

      if (ticket?.solicitante_contato) {
        phone = formatPhone(ticket.solicitante_contato);
        contactName = ticket.solicitante_nome;
      }
    }

    // Fallback: try company WhatsApp
    if (!phone && so.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("whatsapp, nome_fantasia")
        .eq("id", so.company_id)
        .single();

      if (company?.whatsapp) {
        phone = formatPhone(company.whatsapp);
        contactName = contactName || company.nome_fantasia;
      }
    }

    if (!phone) {
      console.log("No valid phone number found for OS notification");
      return new Response(
        JSON.stringify({ skipped: true, reason: "No valid phone number found" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build message
    let message = messageTemplate.replace(/#{numero_os}/g, String(so.numero_os));

    // Add company name
    if (so.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("nome_fantasia")
        .eq("id", so.company_id)
        .single();
      if (company) {
        message += `\n\n🏢 Empresa: ${company.nome_fantasia}`;
      }
    }

    // Add extra details for specific statuses
    if (new_status === "executada" || new_status === "finalizada") {
      if (observacao) {
        message += `\n📝 Observação: ${observacao}`;
      }
    }

    message += "\n\n_Conexão Virtual - Help Desk TI_";

    // Send via Mabbix
    console.log(`Sending OS status notification to ${phone} (status: ${new_status})`);

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
    console.error("notify-os-status error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
