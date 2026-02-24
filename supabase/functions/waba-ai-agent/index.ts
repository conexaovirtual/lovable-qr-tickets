import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) throw new Error("WhatsApp API not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { conversation_id, message_content, phone_number } = await req.json();
    console.log("AI Agent processing:", { conversation_id, message_content: message_content?.substring(0, 100) });

    // Check if AI is enabled for this conversation
    const { data: conversation } = await supabase
      .from("waba_conversations")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (!conversation?.ai_enabled) {
      console.log("AI disabled for conversation", conversation_id);
      return new Response(JSON.stringify({ skipped: true, reason: "ai_disabled" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Gather context for the AI
    const context = await gatherContext(supabase, phone_number, message_content);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Get conversation history (last 20 messages)
    const { data: recentMessages } = await supabase
      .from("waba_messages")
      .select("direction, content, sender_type, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const chatHistory = (recentMessages || []).reverse().map((m) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.content || "",
    }));

    // Call AI
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
        ],
        tools: getTools(),
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const choice = aiResult.choices?.[0];

    if (!choice) throw new Error("No AI response");

    // Handle tool calls
    if (choice.message?.tool_calls?.length) {
      const toolResults = await handleToolCalls(supabase, choice.message.tool_calls, phone_number, conversation_id);
      
      // Get final response after tool execution
      const followUpResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            choice.message,
            ...toolResults,
          ],
        }),
      });

      if (followUpResponse.ok) {
        const followUp = await followUpResponse.json();
        const finalContent = followUp.choices?.[0]?.message?.content;
        if (finalContent) {
          await sendAndSaveReply(supabase, conversation_id, phone_number, finalContent, PHONE_NUMBER_ID, ACCESS_TOKEN);
        }
      }
    } else if (choice.message?.content) {
      await sendAndSaveReply(supabase, conversation_id, phone_number, choice.message.content, PHONE_NUMBER_ID, ACCESS_TOKEN);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("AI Agent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

// ─── Context Gathering ───────────────────────────────────────────────

async function gatherContext(supabase: any, phone: string, message: string) {
  // Search knowledge base for relevant articles
  const { data: articles } = await supabase
    .from("knowledge_articles")
    .select("titulo, problema, solucao, categoria, tags")
    .limit(10);

  // Find matching contact/company
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("*, companies:company_id(nome_fantasia, id)")
    .eq("phone_number", phone)
    .maybeSingle();

  // Get open tickets for this contact's company
  let openTickets: any[] = [];
  if (contact?.company_id) {
    const { data } = await supabase
      .from("tickets")
      .select("numero, titulo, status, prioridade, tecnico_id, created_at")
      .eq("company_id", contact.company_id)
      .in("status", ["novo", "em_atendimento"])
      .order("created_at", { ascending: false })
      .limit(10);
    openTickets = data || [];
  }

  // Get upcoming visits for this company
  let visits: any[] = [];
  if (contact?.company_id) {
    const { data } = await supabase
      .from("visit_schedules")
      .select("proxima_visita, motivo, status, prioridade")
      .eq("company_id", contact.company_id)
      .eq("status", "pendente")
      .order("proxima_visita", { ascending: true })
      .limit(5);
    visits = data || [];
  }

  return { articles, contact, openTickets, visits };
}

// ─── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(context: any) {
  const articlesText = (context.articles || [])
    .map((a: any) => `• ${a.titulo}: ${a.problema} → ${a.solucao}`)
    .join("\n");

  const ticketsText = (context.openTickets || [])
    .map((t: any) => `• #${t.numero} - ${t.titulo} (${t.status}, prioridade: ${t.prioridade})`)
    .join("\n");

  const visitsText = (context.visits || [])
    .map((v: any) => `• ${v.proxima_visita} - ${v.motivo} (${v.status})`)
    .join("\n");

  const companyName = context.contact?.companies?.nome_fantasia || "não identificada";
  const companyId = context.contact?.company_id || null;

  return `Você é o assistente virtual de suporte técnico da Conexão Virtual. Responda SEMPRE em português brasileiro de forma profissional, amigável e objetiva.

EMPRESA DO CLIENTE: ${companyName}
${companyId ? `COMPANY_ID: ${companyId}` : "EMPRESA NÃO IDENTIFICADA - pergunte o nome da empresa se necessário."}

CAPACIDADES:
1. RESPONDER DÚVIDAS TÉCNICAS usando a base de conhecimento abaixo
2. ABRIR CHAMADOS automaticamente quando o cliente reportar um problema
3. CONSULTAR STATUS de chamados existentes
4. INFORMAR sobre visitas agendadas

BASE DE CONHECIMENTO:
${articlesText || "Nenhum artigo disponível."}

CHAMADOS ABERTOS DO CLIENTE:
${ticketsText || "Nenhum chamado aberto."}

VISITAS AGENDADAS:
${visitsText || "Nenhuma visita agendada."}

REGRAS:
- Se o cliente descrever um PROBLEMA técnico que você NÃO consegue resolver pela base de conhecimento, use a ferramenta create_ticket para abrir um chamado.
- Se o cliente perguntar sobre STATUS de chamado, consulte a lista acima e informe.
- Se o cliente pedir para AGENDAR uma visita, use a ferramenta schedule_visit.
- Se não souber a empresa do cliente, pergunte antes de criar chamados.
- Seja conciso. Use emojis com moderação (✅, ⚠️, 📋, 🔧).
- Quando criar um chamado, informe o número ao cliente.
- Nunca invente informações. Se não souber, diga que vai encaminhar para um técnico.`;
}

// ─── Tools Definition ────────────────────────────────────────────────

function getTools() {
  return [
    {
      type: "function",
      function: {
        name: "create_ticket",
        description: "Cria um novo chamado de suporte técnico para o cliente",
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título resumido do problema" },
            descricao: { type: "string", description: "Descrição detalhada do problema reportado pelo cliente" },
            company_id: { type: "string", description: "UUID da empresa do cliente" },
          },
          required: ["titulo", "descricao", "company_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "check_ticket_status",
        description: "Consulta o status de um chamado pelo número",
        parameters: {
          type: "object",
          properties: {
            numero: { type: "number", description: "Número do chamado" },
          },
          required: ["numero"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "schedule_visit",
        description: "Solicita agendamento de visita técnica para a empresa",
        parameters: {
          type: "object",
          properties: {
            company_id: { type: "string", description: "UUID da empresa" },
            motivo: { type: "string", description: "Motivo da visita" },
            data_sugerida: { type: "string", description: "Data sugerida no formato YYYY-MM-DD" },
          },
          required: ["company_id", "motivo"],
          additionalProperties: false,
        },
      },
    },
  ];
}

// ─── Tool Execution ──────────────────────────────────────────────────

async function handleToolCalls(supabase: any, toolCalls: any[], phone: string, conversationId: string) {
  const results = [];

  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    let result: any;

    switch (call.function.name) {
      case "create_ticket": {
        const { data: ticket, error } = await supabase
          .from("tickets")
          .insert({
            titulo: args.titulo,
            descricao: args.descricao,
            company_id: args.company_id,
            canal: "whatsapp",
            status: "novo",
            solicitante_nome: phone,
            solicitante_contato: phone,
          })
          .select("numero, id")
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          result = { success: false, error: error.message };
        } else {
          result = { success: true, numero: ticket.numero, id: ticket.id };
          console.log(`Ticket #${ticket.numero} created via WhatsApp AI`);
        }
        break;
      }

      case "check_ticket_status": {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("numero, titulo, status, prioridade, created_at, tecnico_id")
          .eq("numero", args.numero)
          .maybeSingle();

        if (ticket) {
          result = {
            found: true,
            numero: ticket.numero,
            titulo: ticket.titulo,
            status: ticket.status,
            prioridade: ticket.prioridade,
            criado_em: ticket.created_at,
          };
        } else {
          result = { found: false };
        }
        break;
      }

      case "schedule_visit": {
        const { data: visit, error } = await supabase
          .from("visit_schedules")
          .insert({
            company_id: args.company_id,
            motivo: "corretiva",
            prioridade: "media",
            proxima_visita: args.data_sugerida || new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
            observacoes: `Solicitado via WhatsApp: ${args.motivo}`,
            status: "pendente",
          })
          .select("id, proxima_visita")
          .single();

        if (error) {
          console.error("Error scheduling visit:", error);
          result = { success: false, error: error.message };
        } else {
          result = { success: true, data: visit.proxima_visita };
        }
        break;
      }

      default:
        result = { error: "Unknown tool" };
    }

    results.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }

  return results;
}

// ─── Send & Save Reply ───────────────────────────────────────────────

async function sendAndSaveReply(
  supabase: any,
  conversationId: string,
  phone: string,
  text: string,
  phoneNumberId: string,
  accessToken: string
) {
  // Send via Meta Graph API
  const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });

  const result = await response.json();
  console.log("AI reply sent:", JSON.stringify(result).substring(0, 200));

  if (result.messages?.[0]) {
    await supabase.from("waba_messages").insert({
      conversation_id: conversationId,
      wamid: result.messages[0].id,
      direction: "outbound",
      message_type: "text",
      content: text,
      status: "sent",
      sender_type: "ai",
    });

    await supabase
      .from("waba_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }
}
