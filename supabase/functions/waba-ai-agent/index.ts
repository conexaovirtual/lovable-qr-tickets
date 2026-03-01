import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MABBIX_BACKEND_URL = Deno.env.get("MABBIX_BACKEND_URL");
    const MABBIX_CONNECTION_TOKEN = Deno.env.get("MABBIX_CONNECTION_TOKEN");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!MABBIX_BACKEND_URL || !MABBIX_CONNECTION_TOKEN) throw new Error("Mabbix API not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { conversation_id, message_content, phone_number, is_group, media_url, message_type } = await req.json();
    const isAudioMessage = message_type === "audio";
    console.log("AI Agent processing:", { conversation_id, message_content: message_content?.substring(0, 100), is_group, isAudioMessage });

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

    // Skip groups without a linked company
    if (is_group) {
      const { data: contact } = await supabase
        .from("whatsapp_contacts")
        .select("company_id")
        .eq("phone_number", phone_number)
        .maybeSingle();

      if (!contact?.company_id) {
        console.log("Group without linked company, skipping:", phone_number);
        return new Response(JSON.stringify({ skipped: true, reason: "unlinked_group" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Transcribe audio if needed
    let effectiveMessage = message_content || "";
    if (isAudioMessage && media_url) {
      console.log("Transcribing audio from:", media_url);
      const transcription = await transcribeAudio(media_url, LOVABLE_API_KEY);
      console.log("Audio transcription:", transcription.substring(0, 200));
      effectiveMessage = `[O cliente enviou uma mensagem de voz que foi transcrita automaticamente]: ${transcription}`;
    }

    // Gather enriched context
    const context = await gatherContext(supabase, phone_number, effectiveMessage);

    const systemPrompt = buildSystemPrompt(context);

    // Get conversation history (last 20 messages)
    const { data: recentMessages } = await supabase
      .from("waba_messages")
      .select("direction, content, sender_type, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Only use recent messages (last 8) to avoid context pollution from old conversations
    // Exclude messages with no real content (e.g. "[Mensagem sem texto]", filenames)
    const chatHistory = (recentMessages || [])
      .reverse()
      .filter((m: any) => {
        const c = (m.content || "").trim();
        return c && c !== "[Mensagem sem texto]" && !c.match(/^[a-f0-9-]+_[A-Z0-9]+\.\w+$/);
      })
      .slice(-8)
      .map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || "",
      }));

    // Replace the last user message with the effective (transcribed) version if audio
    if (isAudioMessage && chatHistory.length > 0) {
      const lastIdx = chatHistory.length - 1;
      if (chatHistory[lastIdx].role === "user") {
        chatHistory[lastIdx].content = effectiveMessage;
      } else {
        chatHistory.push({ role: "user", content: effectiveMessage });
      }
    }

    // Call AI with upgraded model
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
          ...chatHistory,
        ],
        tools: getTools(),
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const choice = aiResult.choices?.[0];

    if (!choice) throw new Error("No AI response");

    const isFirstResponse = !conversation.first_response_at;

    // Handle tool calls with multi-round support (up to 3 rounds)
    let currentMessage = choice.message;
    let messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
    ];
    
    const MAX_TOOL_ROUNDS = 3;
    let round = 0;
    
    while (currentMessage?.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
      round++;
      console.log(`Tool call round ${round}:`, currentMessage.tool_calls.map((tc: any) => tc.function?.name).join(", "));
      
      const toolResults = await handleToolCalls(supabase, currentMessage.tool_calls, phone_number, conversation_id, context);
      
      messages = [
        ...messages,
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
          messages,
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
      
      if (!currentMessage) {
        console.error(`No message in follow-up round ${round}`);
        break;
      }
    }

    // Send final text response
    const finalContent = currentMessage?.content;
    if (finalContent) {
      await sendAndSaveReply(supabase, conversation_id, phone_number, finalContent, MABBIX_BACKEND_URL, MABBIX_CONNECTION_TOKEN);
      if (isFirstResponse) await trackFirstResponse(supabase, conversation_id);
    } else {
      console.log("No final content after", round, "tool rounds. Last message:", JSON.stringify(currentMessage).substring(0, 200));
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

// ─── Context Gathering (Enriched) ────────────────────────────────────

async function gatherContext(supabase: any, phone: string, message: string) {
  // Extract keywords from message for relevant search
  const keywords = message
    .toLowerCase()
    .replace(/[^\w\sáéíóúãõâêô]/g, "")
    .split(/\s+/)
    .filter((w: string) => w.length > 3)
    .slice(0, 5);

  // Run all queries in parallel
  const [contactResult, relevantArticles, fallbackArticles] = await Promise.all([
    supabase
      .from("whatsapp_contacts")
      .select("*, companies:company_id(nome_fantasia, id, tipo_contrato, sla_primeiro_atendimento_horas, sla_solucao_horas)")
      .eq("phone_number", phone)
      .maybeSingle(),
    // Search relevant articles by keywords
    keywords.length > 0
      ? supabase
          .from("knowledge_articles")
          .select("titulo, problema, solucao, categoria, tags")
          .or(keywords.map((k: string) => `problema.ilike.%${k}%,solucao.ilike.%${k}%,titulo.ilike.%${k}%`).join(","))
          .order("util_count", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    // Fallback: top articles by usefulness
    supabase
      .from("knowledge_articles")
      .select("titulo, problema, solucao, categoria, tags")
      .order("util_count", { ascending: false })
      .limit(5),
  ]);

  const contact = contactResult.data;
  const companyId = contact?.company_id;

  // Merge relevant + fallback articles (deduplicated)
  const allArticles = relevantArticles.data || [];
  const seenIds = new Set(allArticles.map((a: any) => a.titulo));
  for (const a of (fallbackArticles.data || [])) {
    if (!seenIds.has(a.titulo)) {
      allArticles.push(a);
      seenIds.add(a.titulo);
    }
  }

  // Company-specific queries (run in parallel if company exists)
  let openTickets: any[] = [];
  let visits: any[] = [];
  let assets: any[] = [];
  let recentServices: any[] = [];

  if (companyId) {
    const [ticketsResult, visitsResult, assetsResult, servicesResult] = await Promise.all([
      supabase
        .from("tickets")
        .select("numero, titulo, status, prioridade, tecnico_id, created_at, profiles:tecnico_id(nome)")
        .eq("company_id", companyId)
        .in("status", ["novo", "em_atendimento"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("visit_schedules")
        .select("proxima_visita, motivo, status, prioridade")
        .eq("company_id", companyId)
        .eq("status", "pendente")
        .order("proxima_visita", { ascending: true })
        .limit(5),
      supabase
        .from("assets")
        .select("id, nome, tipo, estado, fabricante, modelo, setor, local")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("daily_service_records")
        .select("titulo, descricao, solucao, status, data_atendimento, canal")
        .eq("company_id", companyId)
        .order("data_atendimento", { ascending: false })
        .limit(10),
    ]);

    openTickets = ticketsResult.data || [];
    visits = visitsResult.data || [];
    assets = assetsResult.data || [];
    recentServices = servicesResult.data || [];
  }

  return { articles: allArticles, contact, openTickets, visits, assets, recentServices, companyId };
}

// ─── System Prompt (Enhanced) ────────────────────────────────────────

function buildSystemPrompt(context: any) {
  const articlesText = (context.articles || [])
    .map((a: any) => `• **${a.titulo}**: ${a.problema} → ${a.solucao}`)
    .join("\n");

  const ticketsText = (context.openTickets || [])
    .map((t: any) => {
      const tecnico = t.profiles?.nome || "não atribuído";
      return `• #${t.numero} - ${t.titulo} (${t.status}, prioridade: ${t.prioridade}, técnico: ${tecnico})`;
    })
    .join("\n");

  const visitsText = (context.visits || [])
    .map((v: any) => `• ${v.proxima_visita} - ${v.motivo} (${v.status}, prioridade: ${v.prioridade})`)
    .join("\n");

  const assetsText = (context.assets || [])
    .map((a: any) => `• ${a.nome} (${a.tipo}, ${a.estado}) - ${a.fabricante || ""} ${a.modelo || ""} | Setor: ${a.setor || "N/A"} | Local: ${a.local || "N/A"}`)
    .join("\n");

  const servicesText = (context.recentServices || [])
    .map((s: any) => `• [${s.data_atendimento}] ${s.titulo}: ${s.descricao?.substring(0, 80)}${s.solucao ? ` → Solução: ${s.solucao.substring(0, 80)}` : ""}`)
    .join("\n");

  const companyName = context.contact?.companies?.nome_fantasia || "não identificada";
  const companyId = context.companyId || null;
  const contractType = context.contact?.companies?.tipo_contrato || "N/A";
  const contactName = context.contact?.contact_name || "não identificado";

  return `Você é o assistente virtual de suporte técnico da **Conexão Virtual**. Responda SEMPRE em português brasileiro de forma profissional, amigável e objetiva.

EMPRESA DO CLIENTE: ${companyName}
CONTATO: ${contactName}
TIPO DE CONTRATO: ${contractType}
${companyId ? `COMPANY_ID: ${companyId}` : `⚠️ EMPRESA NÃO IDENTIFICADA - você DEVE identificar o cliente antes de qualquer ação.
FLUXO OBRIGATÓRIO:
1. Pergunte o nome da empresa do cliente e o nome da pessoa
2. Use find_company para buscar no cadastro
3. Se encontrar: use link_contact IMEDIATAMENTE para vincular o número do contato à empresa (isso é automático, não precisa pedir permissão)
4. Se NÃO encontrar: pergunte os dados básicos e use register_company para cadastrar
IMPORTANTE: O vínculo via link_contact é SILENCIOSO — faça automaticamente após identificar a empresa, apenas informe ao cliente que ele foi identificado.`}

═══════════════════════════════════════
CAPACIDADES:
═══════════════════════════════════════
0. PROCESSAR ÁUDIO: Você CONSEGUE ouvir e entender mensagens de voz — elas são transcritas automaticamente. Quando receber "[O cliente enviou uma mensagem de voz que foi transcrita automaticamente]:", responda normalmente ao conteúdo transcrito. NUNCA diga que não consegue ouvir áudios.
1. RESPONDER DÚVIDAS TÉCNICAS usando a base de conhecimento
2. BUSCAR ATIVAMENTE na base de conhecimento (use search_knowledge_base)
3. IDENTIFICAR CLIENTE: buscar empresa por nome e vincular contato automaticamente
4. CADASTRAR EMPRESA nova quando não existir no sistema
5. ABRIR CHAMADOS com confirmação do cliente e classificação de urgência
6. CONSULTAR STATUS de chamados existentes
7. LISTAR ATIVOS da empresa do cliente
8. ADICIONAR COMENTÁRIOS a chamados existentes
9. INFORMAR sobre visitas agendadas
10. ESCALONAR para técnico (total ou parcial)

═══════════════════════════════════════
BASE DE CONHECIMENTO (artigos relevantes):
═══════════════════════════════════════
${articlesText || "Nenhum artigo encontrado. Use search_knowledge_base para buscar."}

═══════════════════════════════════════
CHAMADOS ABERTOS DO CLIENTE:
═══════════════════════════════════════
${ticketsText || "Nenhum chamado aberto."}

═══════════════════════════════════════
ATIVOS DA EMPRESA:
═══════════════════════════════════════
${assetsText || "Nenhum ativo cadastrado."}

═══════════════════════════════════════
HISTÓRICO DE ATENDIMENTOS RECENTES:
═══════════════════════════════════════
${servicesText || "Sem atendimentos recentes."}

═══════════════════════════════════════
VISITAS AGENDADAS:
═══════════════════════════════════════
${visitsText || "Nenhuma visita agendada."}

═══════════════════════════════════════
REGRAS DE CONDUTA:
═══════════════════════════════════════

⚡ REGRA #1 - PRIORIDADE DA MENSAGEM ATUAL:
- SEMPRE responda à ÚLTIMA mensagem recebida (marcada como [MENSAGEM ATUAL]).
- IGNORE contexto antigo que contradiga a mensagem atual.
- Se o cliente mudou de assunto, acompanhe o novo assunto imediatamente.
- NÃO use nomes ou empresas mencionados em mensagens anteriores se a mensagem atual menciona dados diferentes.

🔍 DIAGNÓSTICO:
- Sempre use search_knowledge_base PROATIVAMENTE para buscar soluções antes de responder sobre problemas técnicos.
- Analise o histórico de atendimentos para identificar problemas recorrentes.
- Verifique se o problema pode estar relacionado a um ativo específico da empresa.

📋 CRIAÇÃO DE CHAMADOS (OBRIGATÓRIO SEGUIR):
- NUNCA crie um chamado sem antes CONFIRMAR com o cliente: "Posso abrir um chamado para este problema?"
- Aguarde a confirmação explícita do cliente (sim, ok, pode, por favor, etc.)
- Ao criar, classifique urgência e impacto baseado nos sintomas:
  • ALTO: Sistema parado, todos afetados, sem workaround
  • MÉDIO: Problema parcial, alguns afetados, workaround disponível
  • BAIXO: Inconveniência menor, um usuário afetado
- Tente identificar o ativo mencionado e vincule ao chamado.
- Se o equipamento NÃO estiver cadastrado nos ativos da empresa, use register_asset para cadastrá-lo ANTES de criar o chamado.
- Pergunte ao cliente informações básicas do equipamento: tipo (notebook, desktop, impressora, etc.), fabricante/modelo se souber.
- Use o nome do contato (${contactName}) como solicitante.

🔄 ESCALONAMENTO GRADUAL:
1. Primeiro: tente resolver com a base de conhecimento
2. Se não resolver: sugira abertura de chamado
3. Se urgente/complexo: use partial_escalate (notifica técnico mas mantém IA ativa)
4. Se crítico ou cliente insistir: use escalate_to_human (transfere completamente)

💬 ESTILO:
- Seja conciso e direto. Use emojis com moderação (✅ ⚠️ 📋 🔧 📞).
- Quando criar um chamado, informe o número ao cliente.
- Nunca invente informações. Se não souber, diga que vai buscar ou encaminhar.
- Se o cliente perguntar algo fora do escopo técnico, redirecione educadamente.`;
}

// ─── Tools Definition (Expanded) ─────────────────────────────────────

function getTools() {
  return [
    {
      type: "function",
      function: {
        name: "create_ticket",
        description: "Cria um novo chamado de suporte. SOMENTE use após confirmação explícita do cliente.",
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título resumido do problema" },
            descricao: { type: "string", description: "Descrição detalhada do problema" },
            company_id: { type: "string", description: "UUID da empresa do cliente" },
            urgencia: { type: "string", enum: ["baixa", "media", "alta"], description: "Nível de urgência" },
            impacto: { type: "string", enum: ["baixo", "medio", "alto"], description: "Nível de impacto" },
            asset_id: { type: "string", description: "UUID do ativo relacionado (opcional)" },
          },
          required: ["titulo", "descricao", "company_id", "urgencia", "impacto"],
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
        name: "search_knowledge_base",
        description: "Busca artigos na base de conhecimento por palavra-chave. Use proativamente antes de responder dúvidas técnicas.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Palavras-chave para buscar (ex: 'impressora não imprime', 'VPN erro')" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_company_assets",
        description: "Lista os ativos (equipamentos) da empresa do cliente, com filtro opcional por tipo ou status",
        parameters: {
          type: "object",
          properties: {
            company_id: { type: "string", description: "UUID da empresa" },
            tipo: { type: "string", description: "Filtrar por tipo (desktop, notebook, impressora, servidor, etc.)" },
            estado: { type: "string", description: "Filtrar por estado (em_uso, estoque, manutencao, baixado)" },
          },
          required: ["company_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_ticket_comment",
        description: "Adiciona um comentário a um chamado existente para follow-up ou atualização",
        parameters: {
          type: "object",
          properties: {
            ticket_numero: { type: "number", description: "Número do chamado" },
            comentario: { type: "string", description: "Comentário a adicionar" },
          },
          required: ["ticket_numero", "comentario"],
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
    {
      type: "function",
      function: {
        name: "escalate_to_human",
        description: "Transfere COMPLETAMENTE a conversa para um técnico humano. A IA deixa de responder.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Motivo da escalação" },
            conversation_id: { type: "string", description: "ID da conversa" },
            resumo: { type: "string", description: "Resumo estruturado: problema, tentativas, classificação de urgência" },
          },
          required: ["reason", "conversation_id", "resumo"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "partial_escalate",
        description: "Notifica um técnico sobre o problema mas mantém a IA ativa como copiloto. Use para problemas que precisam atenção humana mas não requerem transferência imediata.",
        parameters: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "ID da conversa" },
            reason: { type: "string", description: "Motivo da notificação" },
            resumo: { type: "string", description: "Resumo do problema: contexto, diagnóstico, tentativas, classificação" },
            urgencia: { type: "string", enum: ["baixa", "media", "alta"], description: "Urgência da atenção humana" },
          },
          required: ["conversation_id", "reason", "resumo", "urgencia"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "resolve_conversation",
        description: "Marca a conversa como resolvida quando o problema do cliente foi solucionado",
        parameters: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "ID da conversa" },
          },
          required: ["conversation_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "find_company",
        description: "Busca uma empresa cadastrada pelo nome. Use quando o contato não está vinculado a uma empresa e informou o nome dela.",
        parameters: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome da empresa informado pelo cliente (busca parcial)" },
          },
          required: ["nome"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "link_contact",
        description: "Vincula o contato atual a uma empresa existente. Use após encontrar a empresa com find_company.",
        parameters: {
          type: "object",
          properties: {
            company_id: { type: "string", description: "UUID da empresa encontrada" },
            contact_name: { type: "string", description: "Nome do contato informado pelo cliente" },
          },
          required: ["company_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "register_company",
        description: "Cadastra uma nova empresa no sistema quando não encontrada via find_company. Também vincula o contato automaticamente.",
        parameters: {
          type: "object",
          properties: {
            nome_fantasia: { type: "string", description: "Nome fantasia da empresa" },
            telefone: { type: "string", description: "Telefone da empresa (opcional)" },
            email: { type: "string", description: "E-mail da empresa (opcional)" },
            contact_name: { type: "string", description: "Nome do contato/pessoa que está conversando" },
          },
          required: ["nome_fantasia"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "register_asset",
        description: "Cadastra um novo ativo (equipamento) para a empresa do cliente. Use quando o cliente menciona um equipamento que não está cadastrado no sistema. Pergunte informações básicas como nome/identificação, tipo e modelo.",
        parameters: {
          type: "object",
          properties: {
            company_id: { type: "string", description: "UUID da empresa dona do equipamento" },
            nome: { type: "string", description: "Nome ou identificação do equipamento (ex: 'Notebook do João', 'Impressora Recepção')" },
            tipo: { type: "string", enum: ["desktop", "notebook", "servidor", "impressora", "monitor", "roteador", "switch", "modem", "camera", "dvr", "outro"], description: "Tipo do equipamento" },
            fabricante: { type: "string", description: "Fabricante (ex: Dell, HP, Lenovo) - opcional" },
            modelo: { type: "string", description: "Modelo do equipamento - opcional" },
            numero_serie: { type: "string", description: "Número de série - opcional" },
            setor: { type: "string", description: "Setor onde o equipamento fica (ex: Recepção, TI, Financeiro) - opcional" },
          },
          required: ["company_id", "nome", "tipo"],
          additionalProperties: false,
        },
      },
    },
  ];
}

// ─── Tool Execution (Expanded) ───────────────────────────────────────

async function handleToolCalls(supabase: any, toolCalls: any[], phone: string, conversationId: string, context: any) {
  const results = [];

  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    let result: any;

    switch (call.function.name) {
      case "create_ticket": {
        const contactName = context.contact?.contact_name || phone;
        const TECNICO_ID = "e336e78e-c11a-48b5-8d69-2bb48cf6bb3b";
        const TECNICO_PHONE = "5562999522470";

        const { data: ticket, error } = await supabase
          .from("tickets")
          .insert({
            titulo: args.titulo,
            descricao: args.descricao,
            company_id: args.company_id,
            canal: "whatsapp",
            status: "em_atendimento",
            urgencia: args.urgencia || "media",
            impacto: args.impacto || "medio",
            asset_id: args.asset_id || null,
            solicitante_nome: contactName,
            solicitante_contato: phone,
            tecnico_id: TECNICO_ID,
            public_request: true,
          })
          .select("numero, id")
          .single();

        if (error) {
          console.error("Error creating ticket:", error);
          result = { success: false, error: error.message };
        } else {
          result = { success: true, numero: ticket.numero, id: ticket.id };
          console.log(`Ticket #${ticket.numero} created and assigned to Jose Pereira`);

          // Notify technician via WhatsApp
          try {
            const companyName = context.contact?.company?.nome_fantasia || "Empresa não identificada";
            const notifMsg = `🔔 *Novo Chamado #${ticket.numero}*\n\n` +
              `📋 *Título:* ${args.titulo}\n` +
              `🏢 *Empresa:* ${companyName}\n` +
              `👤 *Solicitante:* ${contactName}\n` +
              `📞 *Contato:* ${phone}\n` +
              `⚡ *Urgência:* ${args.urgencia || "media"}\n` +
              `💥 *Impacto:* ${args.impacto || "medio"}\n\n` +
              `📝 *Descrição:*\n${args.descricao}\n\n` +
              `${args.asset_id ? `🖥️ *Ativo vinculado:* Sim` : `🖥️ *Ativo:* Não vinculado`}`;

            const MABBIX_URL = Deno.env.get("MABBIX_BACKEND_URL");
            const MABBIX_TOKEN = Deno.env.get("MABBIX_CONNECTION_TOKEN");
            if (MABBIX_URL && MABBIX_TOKEN) {
              await fetch(`${MABBIX_URL}/api/messages/send`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${MABBIX_TOKEN}`,
                },
                body: JSON.stringify({
                  number: TECNICO_PHONE,
                  text: notifMsg,
                }),
              });
              console.log(`WhatsApp notification sent to technician ${TECNICO_PHONE}`);
            }
          } catch (notifErr) {
            console.error("Failed to notify technician:", notifErr);
            // Don't fail the ticket creation if notification fails
          }
        }
        break;
      }

      case "check_ticket_status": {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("numero, titulo, status, prioridade, created_at, tecnico_id, profiles:tecnico_id(nome)")
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
            tecnico: ticket.profiles?.nome || "não atribuído",
          };
        } else {
          result = { found: false };
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
          .select("titulo, problema, solucao, categoria, tags")
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

      case "list_company_assets": {
        let query = supabase
          .from("assets")
          .select("id, nome, tipo, estado, fabricante, modelo, setor, local, numero_serie")
          .eq("company_id", args.company_id);

        if (args.tipo) query = query.eq("tipo", args.tipo);
        if (args.estado) query = query.eq("estado", args.estado);

        const { data: assets } = await query.order("nome").limit(20);

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

      case "add_ticket_comment": {
        // Find ticket by number
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id")
          .eq("numero", args.ticket_numero)
          .maybeSingle();

        if (!ticket) {
          result = { success: false, error: "Chamado não encontrado" };
        } else {
          // Use service role to insert comment as system
          const { error } = await supabase
            .from("ticket_comments")
            .insert({
              ticket_id: ticket.id,
              user_id: "00000000-0000-0000-0000-000000000000", // system user placeholder
              comentario: `[Via WhatsApp IA] ${args.comentario}`,
              is_internal: true,
            });

          if (error) {
            console.error("Error adding comment:", error);
            result = { success: false, error: error.message };
          } else {
            result = { success: true };
          }
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

      case "escalate_to_human": {
        await supabase
          .from("waba_conversations")
          .update({ ai_enabled: false, queue_status: "waiting" })
          .eq("id", args.conversation_id);

        await supabase.from("waba_messages").insert({
          conversation_id: args.conversation_id,
          direction: "outbound",
          message_type: "system",
          content: `⚠️ Escalado para técnico: ${args.reason}\n\n📋 Resumo da IA:\n${args.resumo}`,
          status: "delivered",
          sender_type: "system",
        });

        result = { success: true, reason: args.reason };
        console.log(`Conversation ${args.conversation_id} fully escalated: ${args.reason}`);
        break;
      }

      case "partial_escalate": {
        // Keep AI enabled but notify team
        await supabase
          .from("waba_conversations")
          .update({
            queue_status: "ai_copilot",
            ai_context: {
              escalation_reason: args.reason,
              resumo: args.resumo,
              urgencia: args.urgencia,
              escalated_at: new Date().toISOString(),
            },
          })
          .eq("id", args.conversation_id);

        await supabase.from("waba_messages").insert({
          conversation_id: args.conversation_id,
          direction: "outbound",
          message_type: "system",
          content: `📋 Notificação para equipe técnica (urgência: ${args.urgencia}):\n${args.reason}\n\nResumo: ${args.resumo}\n\n🤖 IA continua ativa como copiloto.`,
          status: "delivered",
          sender_type: "system",
        });

        result = { success: true, mode: "ai_copilot", urgencia: args.urgencia };
        console.log(`Conversation ${args.conversation_id} partially escalated (copilot mode): ${args.reason}`);
        break;
      }

      case "resolve_conversation": {
        await supabase
          .from("waba_conversations")
          .update({ queue_status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", args.conversation_id);

        await supabase.from("waba_messages").insert({
          conversation_id: args.conversation_id,
          direction: "outbound",
          message_type: "system",
          content: "✅ Conversa resolvida pela IA",
          status: "delivered",
          sender_type: "system",
        });

        result = { success: true };
        console.log(`Conversation ${args.conversation_id} resolved by AI`);
        break;
      }

      case "find_company": {
        const searchName = args.nome.trim();
        const { data: companies } = await supabase
          .from("companies")
          .select("id, nome_fantasia, razao_social, cnpj, telefone, tipo_contrato")
          .or(`nome_fantasia.ilike.%${searchName}%,razao_social.ilike.%${searchName}%`)
          .eq("status", true)
          .limit(5);

        if (companies && companies.length > 0) {
          result = {
            found: true,
            total: companies.length,
            companies: companies.map((c: any) => ({
              id: c.id,
              nome_fantasia: c.nome_fantasia,
              razao_social: c.razao_social,
              cnpj: c.cnpj,
              tipo_contrato: c.tipo_contrato,
            })),
          };
        } else {
          result = { found: false, message: "Nenhuma empresa encontrada com esse nome." };
        }
        console.log(`find_company "${searchName}": ${(companies || []).length} results`);
        break;
      }

      case "link_contact": {
        // Update whatsapp_contacts with company_id
        const { error: linkError } = await supabase
          .from("whatsapp_contacts")
          .upsert({
            phone_number: phone,
            company_id: args.company_id,
            contact_name: args.contact_name || null,
            last_message_at: new Date().toISOString(),
          }, { onConflict: "phone_number" });

        if (linkError) {
          console.error("Error linking contact:", linkError);
          result = { success: false, error: linkError.message };
        } else {
          // Also update conversation contact_name
          await supabase
            .from("waba_conversations")
            .update({ contact_name: args.contact_name || null })
            .eq("id", conversationId);

          result = { success: true, company_id: args.company_id };
          console.log(`Contact ${phone} linked to company ${args.company_id}`);
        }
        break;
      }

      case "register_company": {
        // Create the company
        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            nome_fantasia: args.nome_fantasia,
            telefone: args.telefone || null,
            email: args.email || null,
            whatsapp: phone,
            tipo_contrato: "eventual",
            status: true,
          })
          .select("id, nome_fantasia")
          .single();

        if (companyError) {
          console.error("Error registering company:", companyError);
          result = { success: false, error: companyError.message };
        } else {
          // Auto-link the contact to the new company
          await supabase
            .from("whatsapp_contacts")
            .upsert({
              phone_number: phone,
              company_id: newCompany.id,
              contact_name: args.contact_name || null,
              last_message_at: new Date().toISOString(),
            }, { onConflict: "phone_number" });

          await supabase
            .from("waba_conversations")
            .update({ contact_name: args.contact_name || null })
            .eq("id", conversationId);

          result = {
            success: true,
            company_id: newCompany.id,
            nome_fantasia: newCompany.nome_fantasia,
            message: "Empresa cadastrada e contato vinculado automaticamente.",
          };
          console.log(`Company "${args.nome_fantasia}" registered and contact ${phone} linked`);
        }
        break;
      }

      case "register_asset": {
        const { data: newAsset, error: assetError } = await supabase
          .from("assets")
          .insert({
            company_id: args.company_id,
            nome: args.nome,
            tipo: args.tipo,
            fabricante: args.fabricante || null,
            modelo: args.modelo || null,
            numero_serie: args.numero_serie || null,
            setor: args.setor || null,
            estado: "em_uso",
          })
          .select("id, nome, tipo")
          .single();

        if (assetError) {
          console.error("Error registering asset:", assetError);
          result = { success: false, error: assetError.message };
        } else {
          result = { success: true, asset_id: newAsset.id, nome: newAsset.nome, tipo: newAsset.tipo };
          console.log(`Asset "${newAsset.nome}" (${newAsset.tipo}) registered for company ${args.company_id}`);
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

// ─── Send & Save Reply via Mabbix ────────────────────────────────────

async function sendAndSaveReply(
  supabase: any,
  conversationId: string,
  phone: string,
  text: string,
  mabbixUrl: string,
  mabbixToken: string
) {
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
  console.log("AI reply sent via Mabbix:", JSON.stringify(result).substring(0, 200));

  const messageId = result?.id || result?.message?.id || null;
  await supabase.from("waba_messages").insert({
    conversation_id: conversationId,
    wamid: messageId ? String(messageId) : null,
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

// ─── Track First Response ────────────────────────────────────────────

async function trackFirstResponse(supabase: any, conversationId: string) {
  await supabase
    .from("waba_conversations")
    .update({ first_response_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// ─── Audio Transcription via Gemini ──────────────────────────────────

async function transcribeAudio(mediaUrl: string, apiKey: string): Promise<string> {
  try {
    // Download audio file
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) throw new Error(`Failed to download audio: ${audioResponse.status}`);

    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = btoa(
      Array.from(new Uint8Array(audioBuffer))
        .map((b) => String.fromCharCode(b))
        .join("")
    );

    // Detect format from URL or content-type
    const contentType = audioResponse.headers.get("content-type") || "audio/ogg";
    const format = contentType.includes("ogg") ? "ogg" : contentType.includes("mp3") ? "mp3" : contentType.includes("mp4") || contentType.includes("m4a") ? "m4a" : "ogg";

    console.log(`Audio downloaded: ${audioBuffer.byteLength} bytes, format: ${format}`);

    // Use Gemini to transcribe (it supports audio natively)
    const transcribeResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem comentários adicionais. Se não conseguir entender, diga 'Não foi possível entender o áudio'.",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: format,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      console.error("Transcription error:", errText);
      throw new Error(`Transcription failed: ${transcribeResponse.status}`);
    }

    const transcribeResult = await transcribeResponse.json();
    const transcription = transcribeResult.choices?.[0]?.message?.content?.trim();

    if (!transcription) throw new Error("Empty transcription");

    return transcription;
  } catch (error: any) {
    console.error("Audio transcription failed:", error);
    return "[Áudio recebido - não foi possível transcrever]";
  }
}

// ─── Send Audio Reply via Lovable AI (Google TTS - Free) + Mabbix ────

async function sendAudioReply(
  supabase: any,
  conversationId: string,
  phone: string,
  text: string,
  mabbixUrl: string,
  mabbixToken: string
) {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("LOVABLE_API_KEY not configured, skipping audio reply");
      return;
    }

    // Limit text for TTS
    const ttsText = text.substring(0, 3000);

    // Use Gemini multimodal to generate speech audio
    // We ask Gemini to produce a spoken audio response
    const ttsResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: "Kore",
            },
          },
        },
        messages: [
          {
            role: "system",
            content: "Você é uma assistente de suporte técnico brasileira. Leia o texto fornecido em voz alta de forma natural, clara e profissional em português brasileiro. Não adicione nenhum comentário, apenas fale o texto.",
          },
          {
            role: "user",
            content: `Leia este texto em voz alta: "${ttsText}"`,
          },
        ],
      }),
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("Lovable AI TTS error:", ttsResponse.status, errText);
      return;
    }

    const ttsResult = await ttsResponse.json();
    
    // Extract audio data from the response
    const audioContent = ttsResult.choices?.[0]?.message?.audio?.data;
    
    if (!audioContent) {
      console.log("No audio data in TTS response, skipping audio reply");
      return;
    }

    console.log(`TTS audio generated via Lovable AI`);

    // Send audio via Mabbix (base64 audio)
    const sendResponse = await fetch(`${mabbixUrl}/api/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mabbixToken}`,
      },
      body: JSON.stringify({
        number: phone,
        openTicket: "0",
        queueId: "0",
        body: `data:audio/mp3;base64,${audioContent}`,
        isAudio: true,
      }),
    });

    const sendResult = await sendResponse.json();
    console.log("Audio reply sent via Mabbix:", JSON.stringify(sendResult).substring(0, 200));

    // Save audio message to DB
    const messageId = sendResult?.id || sendResult?.message?.id || null;
    await supabase.from("waba_messages").insert({
      conversation_id: conversationId,
      wamid: messageId ? String(messageId) : null,
      direction: "outbound",
      message_type: "audio",
      content: `[Áudio] ${text.substring(0, 200)}`,
      status: "sent",
      sender_type: "ai",
    });

    await supabase
      .from("waba_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    console.log("Audio reply saved and sent successfully");
  } catch (error: any) {
    console.error("Failed to send audio reply:", error);
    // Don't throw - audio is supplementary, text was already sent
  }
}
