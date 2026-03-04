import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract user from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { messages } = await req.json();

    // ─── Gather user context (Fase 3) ─────────────────────────────
    const context = await gatherUserContext(supabaseAdmin, userId);
    const systemPrompt = buildSystemPrompt(context);

    // ─── First AI call with tools ─────────────────────────────────
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: getTools(),
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const choice = aiResult.choices?.[0];
    if (!choice) throw new Error("No AI response");

    // ─── Multi-round tool calling (up to 3 rounds) ────────────────
    let currentMessage = choice.message;
    let conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const MAX_TOOL_ROUNDS = 3;
    let round = 0;

    while (currentMessage?.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
      round++;
      console.log(`Tool call round ${round}:`, currentMessage.tool_calls.map((tc: any) => tc.function?.name).join(", "));

      const toolResults = await handleToolCalls(supabaseAdmin, currentMessage.tool_calls, userId, context);

      conversationMessages = [
        ...conversationMessages,
        currentMessage,
        ...toolResults,
      ];

      const followUpResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: conversationMessages,
          tools: getTools(),
          tool_choice: "auto",
        }),
      });

      if (!followUpResponse.ok) {
        console.error(`Follow-up round ${round} failed:`, followUpResponse.status);
        break;
      }

      const followUp = await followUpResponse.json();
      currentMessage = followUp.choices?.[0]?.message;

      if (!currentMessage) break;
    }

    // ─── Final streaming response ─────────────────────────────────
    // If we went through tool rounds, make a final streaming call
    if (round > 0) {
      const finalContent = currentMessage?.content?.trim();
      if (!finalContent) {
        // Generate final response after tool calls
        conversationMessages.push(currentMessage || { role: "assistant", content: "" });
      }

      const streamResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            ...conversationMessages,
            ...(finalContent ? [] : [{ role: "user", content: "[SISTEMA] Você executou ferramentas. Agora gere uma resposta amigável resumindo o que foi feito." }]),
          ],
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        // Fallback: return non-streamed content
        const fallbackText = finalContent || "Pronto! Ação executada com sucesso.";
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: fallbackText } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }
        );
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — stream directly
    if (currentMessage?.content) {
      // Re-do the call with streaming enabled
      const streamResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        // Return the non-streamed content as SSE
        const text = currentMessage.content;
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }
        );
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Desculpe, não consegui processar sua solicitação." } }] })}\n\ndata: [DONE]\n\n`,
      { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } }
    );
  } catch (e) {
    console.error("chat error:", e);
    const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Context Gathering (Fase 3) ──────────────────────────────────────

async function gatherUserContext(supabase: any, userId: string) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [profileResult, rolesResult, todayOsResult, todayVisitsResult, pendingTicketsResult, companiesResult] = await Promise.all([
    supabase.from("profiles").select("nome, company_id, telefone").eq("id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("service_orders")
      .select("numero_os, descricao_servicos, hora_agendada, modalidade, tipo_servico, status, prioridade, companies:company_id(nome_fantasia)")
      .gte("data_agendada", `${todayStr}T00:00:00`)
      .lte("data_agendada", `${todayStr}T23:59:59`)
      .order("hora_agendada"),
    supabase
      .from("visit_schedules")
      .select("proxima_visita, motivo, prioridade, status, companies:company_id(nome_fantasia)")
      .eq("proxima_visita", todayStr)
      .eq("status", "pendente"),
    supabase
      .from("tickets")
      .select("numero, titulo, status, prioridade, created_at, companies:company_id(nome_fantasia)")
      .in("status", ["novo", "em_atendimento"])
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("companies").select("id, nome_fantasia").eq("status", true).order("nome_fantasia").limit(100),
  ]);

  const profile = profileResult.data;
  const roles = (rolesResult.data || []).map((r: any) => r.role);
  const isAdmin = roles.includes("admin_provedor");

  const todayAgenda = [
    ...(todayOsResult.data || []).map((o: any) => ({
      type: "OS",
      hora: o.hora_agendada?.substring(0, 5) || "--:--",
      descricao: `OS #${o.numero_os} - ${o.companies?.nome_fantasia || "N/A"} (${o.tipo_servico || "corretivo"}, ${o.modalidade || "presencial"})`,
      status: o.status,
      prioridade: o.prioridade,
    })),
    ...(todayVisitsResult.data || []).map((v: any) => ({
      type: "Visita",
      hora: "--:--",
      descricao: `Visita - ${v.companies?.nome_fantasia || "N/A"} (${v.motivo})`,
      status: v.status,
      prioridade: v.prioridade,
    })),
  ].sort((a, b) => a.hora.localeCompare(b.hora));

  return {
    userId,
    profile,
    roles,
    isAdmin,
    todayAgenda,
    pendingTickets: pendingTicketsResult.data || [],
    companies: companiesResult.data || [],
  };
}

// ─── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(context: any) {
  const userName = context.profile?.nome || "Usuário";
  const rolesText = context.roles.join(", ") || "sem role";

  const agendaText = context.todayAgenda.length > 0
    ? context.todayAgenda.map((a: any) => `  ${a.hora} - ${a.descricao} (${a.status})`).join("\n")
    : "  Nenhum compromisso agendado para hoje.";

  const ticketsText = (context.pendingTickets || [])
    .map((t: any) => `  #${t.numero} - ${t.titulo} (${t.status}, ${t.prioridade}) - ${t.companies?.nome_fantasia || "N/A"}`)
    .join("\n") || "  Nenhum chamado pendente.";

  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const timeStr = `${String(brtHour).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

  return `Você é a assistente pessoal de ${userName} na Conexão Virtual Soluções Tecnológicas.
Horário atual: ${timeStr} (BRT)
Data: ${new Date().toISOString().split("T")[0]}
Cargo/Role: ${rolesText}
${context.isAdmin ? "Este usuário é ADMINISTRADOR — tem acesso total ao sistema." : ""}

SUAS CAPACIDADES:
- Consultar e gerenciar a agenda (OS, visitas, atendimentos)
- Criar ordens de serviço (OS) com agendamento inteligente
- Criar e gerenciar chamados/tickets
- Listar e buscar empresas
- Listar ativos de empresas
- Buscar na base de conhecimento
- Atualizar status de chamados

AGENDA DE HOJE:
${agendaText}

CHAMADOS PENDENTES:
${ticketsText}

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja conciso, direto e profissional mas amigável
- Use markdown para formatação (negrito, listas, etc.)
- Quando o usuário pedir para criar algo, execute a ação e confirme
- Quando consultar dados, apresente de forma organizada
- Se não tiver certeza sobre parâmetros, pergunte antes de executar
- Ao criar OS, use o Smart Scheduler para encontrar o melhor horário
- Ao listar empresas, mostre nome e ID para referência

IMPORTANTE: Você é uma assistente INTERNA do sistema. O usuário logado é um técnico/gestor, não um cliente externo.`;
}

// ─── Tools Definition ────────────────────────────────────────────────

function getTools() {
  return [
    {
      type: "function",
      function: {
        name: "check_agenda",
        description: "Consulta a agenda de compromissos (OS, visitas, atendimentos) para uma data específica. Se não informar data, usa hoje.",
        parameters: {
          type: "object",
          properties: {
            data: { type: "string", description: "Data no formato YYYY-MM-DD (opcional, padrão: hoje)" },
          },
          required: [],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_service_order",
        description: "Cria uma nova ordem de serviço (OS) com agendamento inteligente via Smart Scheduler.",
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título/descrição breve da OS" },
            descricao: { type: "string", description: "Descrição detalhada do serviço" },
            company_id: { type: "string", description: "UUID da empresa" },
            data_preferida: { type: "string", description: "Data preferida YYYY-MM-DD (opcional)" },
            tipo_servico: { type: "string", enum: ["preventivo", "corretivo", "instalacao", "outro"], description: "Tipo de serviço" },
            prioridade: { type: "string", enum: ["baixa", "media", "alta"], description: "Prioridade" },
            modalidade: { type: "string", enum: ["presencial", "remoto"], description: "Modalidade (opcional, Smart Scheduler decide)" },
          },
          required: ["titulo", "descricao", "company_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_ticket",
        description: "Cria um novo chamado/ticket de suporte.",
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título do chamado" },
            descricao: { type: "string", description: "Descrição do problema" },
            company_id: { type: "string", description: "UUID da empresa" },
            urgencia: { type: "string", enum: ["baixa", "media", "alta"], description: "Urgência" },
            impacto: { type: "string", enum: ["baixo", "medio", "alto"], description: "Impacto" },
            asset_id: { type: "string", description: "UUID do ativo (opcional)" },
          },
          required: ["titulo", "descricao", "company_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_tickets",
        description: "Lista chamados/tickets com filtros opcionais.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["novo", "em_atendimento", "resolvido", "fechado"], description: "Filtrar por status" },
            company_id: { type: "string", description: "Filtrar por empresa" },
            limit: { type: "number", description: "Quantidade máxima (padrão: 10)" },
          },
          required: [],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_ticket_status",
        description: "Atualiza o status de um chamado existente.",
        parameters: {
          type: "object",
          properties: {
            ticket_numero: { type: "number", description: "Número do chamado" },
            status: { type: "string", enum: ["novo", "em_atendimento", "resolvido", "fechado"], description: "Novo status" },
            solucao: { type: "string", description: "Solução aplicada (obrigatório se resolvido)" },
          },
          required: ["ticket_numero", "status"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_knowledge_base",
        description: "Busca artigos na base de conhecimento por palavras-chave.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Palavras-chave para buscar" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_companies",
        description: "Lista empresas cadastradas. Pode buscar por nome.",
        parameters: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Filtrar por nome (busca parcial)" },
          },
          required: [],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_assets",
        description: "Lista ativos/equipamentos de uma empresa.",
        parameters: {
          type: "object",
          properties: {
            company_id: { type: "string", description: "UUID da empresa" },
            tipo: { type: "string", description: "Filtrar por tipo (desktop, notebook, impressora, etc.)" },
          },
          required: ["company_id"],
          additionalProperties: false,
        },
      },
    },
  ];
}

// ─── Tool Execution ──────────────────────────────────────────────────

async function handleToolCalls(supabase: any, toolCalls: any[], userId: string, context: any) {
  const results = [];

  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    let result: any;

    switch (call.function.name) {
      case "check_agenda": {
        const targetDate = args.data || new Date().toISOString().split("T")[0];
        const [osRes, visitRes, dailyRes] = await Promise.all([
          supabase
            .from("service_orders")
            .select("numero_os, descricao_servicos, hora_agendada, modalidade, tipo_servico, status, prioridade, companies:company_id(nome_fantasia)")
            .gte("data_agendada", `${targetDate}T00:00:00`)
            .lte("data_agendada", `${targetDate}T23:59:59`)
            .order("hora_agendada"),
          supabase
            .from("visit_schedules")
            .select("proxima_visita, motivo, prioridade, status, companies:company_id(nome_fantasia)")
            .eq("proxima_visita", targetDate),
          supabase
            .from("daily_service_records")
            .select("titulo, status, hora_inicio, canal, companies:company_id(nome_fantasia)")
            .eq("data_atendimento", targetDate),
        ]);

        result = {
          data: targetDate,
          os_agendadas: (osRes.data || []).map((o: any) => ({
            numero: o.numero_os,
            hora: o.hora_agendada?.substring(0, 5) || "--:--",
            empresa: o.companies?.nome_fantasia || "N/A",
            tipo: o.tipo_servico,
            modalidade: o.modalidade,
            status: o.status,
            descricao: o.descricao_servicos?.substring(0, 80),
          })),
          visitas: (visitRes.data || []).map((v: any) => ({
            empresa: v.companies?.nome_fantasia || "N/A",
            motivo: v.motivo,
            prioridade: v.prioridade,
            status: v.status,
          })),
          atendimentos: (dailyRes.data || []).map((d: any) => ({
            titulo: d.titulo,
            empresa: d.companies?.nome_fantasia || "N/A",
            hora: d.hora_inicio?.substring(0, 5),
            status: d.status,
          })),
          total: (osRes.data?.length || 0) + (visitRes.data?.length || 0) + (dailyRes.data?.length || 0),
        };
        console.log(`check_agenda for ${targetDate}: ${result.total} items`);
        break;
      }

      case "create_service_order": {
        try {
          const schedulerResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-scheduler`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                tecnico_id: userId,
                description: `${args.titulo} ${args.descricao}`,
                prioridade: args.prioridade || "media",
                preferred_date: args.data_preferida,
              }),
            }
          );

          if (!schedulerResponse.ok) {
            result = { success: false, error: "Smart Scheduler indisponível" };
            break;
          }

          const slot = await schedulerResponse.json();
          if (!slot.success) {
            result = { success: false, error: "Nenhum slot disponível" };
            break;
          }

          const { data: lastOs } = await supabase
            .from("service_orders")
            .select("numero_os")
            .order("numero_os", { ascending: false })
            .limit(1);
          const nextNumber = (lastOs?.[0]?.numero_os || 0) + 1;

          const { data: company } = await supabase
            .from("companies")
            .select("endereco, telefone")
            .eq("id", args.company_id)
            .single();

          const finalModalidade = args.modalidade || slot.modalidade;

          const { data: os, error: osErr } = await supabase
            .from("service_orders")
            .insert({
              company_id: args.company_id,
              tecnico_id: userId,
              tipo_servico: args.tipo_servico || "corretivo",
              prioridade: args.prioridade || "media",
              modalidade: finalModalidade,
              descricao_servicos: `${args.titulo}\n\n${args.descricao}`,
              data_agendada: `${slot.data}T${slot.hora_inicio}:00`,
              hora_agendada: slot.hora_inicio,
              status: "agendada",
              numero_os: nextNumber,
              endereco_atendimento: finalModalidade === "presencial" ? (company?.endereco || null) : null,
              telefone_contato: company?.telefone || null,
              observacoes: "OS criada via Assistente IA",
            })
            .select("id, numero_os")
            .single();

          if (osErr) {
            result = { success: false, error: osErr.message };
          } else {
            result = {
              success: true,
              numero_os: os.numero_os,
              data: slot.data,
              hora: `${slot.hora_inicio}-${slot.hora_fim}`,
              modalidade: finalModalidade,
            };
            console.log(`OS #${os.numero_os} created via AI assistant`);
          }
        } catch (err: any) {
          result = { success: false, error: err.message };
        }
        break;
      }

      case "create_ticket": {
        const { data: ticket, error } = await supabase
          .from("tickets")
          .insert({
            titulo: args.titulo,
            descricao: args.descricao,
            company_id: args.company_id,
            canal: "sistema_ia",
            status: "novo",
            urgencia: args.urgencia || "media",
            impacto: args.impacto || "medio",
            asset_id: args.asset_id || null,
            solicitante_id: userId,
            tecnico_id: userId,
          })
          .select("numero, id")
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          result = { success: false, error: error.message };
        } else {
          result = { success: true, numero: ticket.numero, id: ticket.id };
          console.log(`Ticket #${ticket.numero} created via AI assistant`);
        }
        break;
      }

      case "list_tickets": {
        let query = supabase
          .from("tickets")
          .select("numero, titulo, status, prioridade, created_at, companies:company_id(nome_fantasia), profiles:tecnico_id(nome)")
          .order("created_at", { ascending: false })
          .limit(args.limit || 10);

        if (args.status) query = query.eq("status", args.status);
        if (args.company_id) query = query.eq("company_id", args.company_id);

        const { data: tickets } = await query;

        result = {
          total: (tickets || []).length,
          tickets: (tickets || []).map((t: any) => ({
            numero: t.numero,
            titulo: t.titulo,
            status: t.status,
            prioridade: t.prioridade,
            empresa: t.companies?.nome_fantasia || "N/A",
            tecnico: t.profiles?.nome || "não atribuído",
            criado_em: t.created_at,
          })),
        };
        break;
      }

      case "update_ticket_status": {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id, numero, status")
          .eq("numero", args.ticket_numero)
          .maybeSingle();

        if (!ticket) {
          result = { success: false, error: "Chamado não encontrado" };
        } else {
          const updateData: any = { status: args.status };
          if (args.status === "resolvido") {
            updateData.solucao = args.solucao || "Resolvido via Assistente IA";
            updateData.data_solucao = new Date().toISOString();
          }
          if (args.status === "fechado") {
            updateData.data_fechamento = new Date().toISOString();
          }

          const { error: updateError } = await supabase
            .from("tickets")
            .update(updateData)
            .eq("id", ticket.id);

          if (updateError) {
            result = { success: false, error: updateError.message };
          } else {
            // Add comment
            await supabase.from("ticket_comments").insert({
              ticket_id: ticket.id,
              user_id: userId,
              comentario: `[Via Assistente IA] Status alterado para: ${args.status}${args.solucao ? `. Solução: ${args.solucao}` : ""}`,
              is_internal: true,
            });

            result = { success: true, numero: ticket.numero, novo_status: args.status };
            console.log(`Ticket #${ticket.numero} updated to ${args.status} via AI assistant`);
          }
        }
        break;
      }

      case "search_knowledge_base": {
        const searchTerms = args.query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const orConditions = searchTerms
          .map((t: string) => `problema.ilike.%${t}%,solucao.ilike.%${t}%,titulo.ilike.%${t}%`)
          .join(",");

        const { data: articles } = await supabase
          .from("knowledge_articles")
          .select("titulo, problema, solucao, categoria")
          .or(orConditions)
          .order("util_count", { ascending: false })
          .limit(5);

        result = {
          found: (articles || []).length,
          articles: (articles || []).map((a: any) => ({
            titulo: a.titulo,
            problema: a.problema,
            solucao: a.solucao,
            categoria: a.categoria,
          })),
        };
        break;
      }

      case "list_companies": {
        let query = supabase
          .from("companies")
          .select("id, nome_fantasia, cnpj, tipo_contrato, telefone")
          .eq("status", true)
          .order("nome_fantasia")
          .limit(20);

        if (args.nome) {
          query = query.ilike("nome_fantasia", `%${args.nome}%`);
        }

        const { data: companies } = await query;

        result = {
          total: (companies || []).length,
          companies: (companies || []).map((c: any) => ({
            id: c.id,
            nome: c.nome_fantasia,
            cnpj: c.cnpj,
            contrato: c.tipo_contrato,
            telefone: c.telefone,
          })),
        };
        break;
      }

      case "list_assets": {
        let query = supabase
          .from("assets")
          .select("id, nome, tipo, estado, fabricante, modelo, setor, local")
          .eq("company_id", args.company_id)
          .order("nome")
          .limit(20);

        if (args.tipo) query = query.eq("tipo", args.tipo);

        const { data: assets } = await query;

        result = {
          total: (assets || []).length,
          assets: (assets || []).map((a: any) => ({
            id: a.id,
            nome: a.nome,
            tipo: a.tipo,
            estado: a.estado,
            fabricante: a.fabricante,
            modelo: a.modelo,
            setor: a.setor,
            local: a.local,
          })),
        };
        break;
      }

      default:
        result = { error: "Ferramenta desconhecida" };
    }

    results.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }

  return results;
}
