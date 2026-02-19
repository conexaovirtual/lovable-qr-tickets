import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();
    
    if (!ticket_id) {
      throw new Error('ticket_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        companies(nome_fantasia),
        assets(tipo, nome, fabricante, modelo, sistema_operacional),
        ticket_comments(comentario, created_at, is_internal)
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) throw new Error('Ticket não encontrado');

    // Buscar tickets similares resolvidos (mesma empresa ou mesmo ativo)
    let similarQuery = supabase
      .from('tickets')
      .select('titulo, descricao, solucao')
      .in('status', ['resolvido', 'fechado'])
      .not('solucao', 'is', null)
      .neq('id', ticket_id)
      .order('created_at', { ascending: false })
      .limit(15);

    if (ticket.asset_id) {
      similarQuery = similarQuery.eq('asset_id', ticket.asset_id);
    } else {
      similarQuery = similarQuery.eq('company_id', ticket.company_id);
    }

    const { data: similarTickets } = await similarQuery;

    // Se não encontrou tickets do mesmo ativo, buscar da empresa
    let fallbackTickets: any[] = [];
    if ((!similarTickets || similarTickets.length < 3) && ticket.asset_id) {
      const { data: companyTickets } = await supabase
        .from('tickets')
        .select('titulo, descricao, solucao')
        .eq('company_id', ticket.company_id)
        .in('status', ['resolvido', 'fechado'])
        .not('solucao', 'is', null)
        .neq('id', ticket_id)
        .order('created_at', { ascending: false })
        .limit(10);
      fallbackTickets = companyTickets || [];
    }

    const allSimilar = [...(similarTickets || []), ...fallbackTickets].slice(0, 15);

    const comments = (ticket.ticket_comments || [])
      .filter((c: any) => c.is_internal)
      .map((c: any) => c.comentario)
      .join('\n');

    // Chamar Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um técnico de TI experiente. Com base na descrição do chamado, comentários internos e histórico de soluções anteriores, sugira uma solução detalhada e profissional.

A solução deve:
- Ser objetiva e técnica
- Descrever os passos realizados
- Incluir verificações feitas
- Mencionar se houve troca de peças ou configuração
- Ter entre 50 e 200 palavras
- Ser escrita em português brasileiro

Responda APENAS com o texto da solução, sem formatação JSON, sem títulos, sem markdown.`
          },
          {
            role: "user",
            content: `CHAMADO:
Título: ${ticket.titulo}
Descrição: ${ticket.descricao}
Empresa: ${ticket.companies?.nome_fantasia || 'N/A'}
Ativo: ${ticket.assets ? `${ticket.assets.tipo} - ${ticket.assets.nome} (${ticket.assets.fabricante || ''} ${ticket.assets.modelo || ''}) - SO: ${ticket.assets.sistema_operacional || 'N/A'}` : 'Não especificado'}

COMENTÁRIOS INTERNOS DO TÉCNICO:
${comments || 'Nenhum comentário interno'}

SOLUÇÕES DE CHAMADOS SIMILARES ANTERIORES:
${allSimilar.map((t: any, i: number) => `${i + 1}. Problema: ${t.titulo}\n   Solução: ${t.solucao}`).join('\n\n') || 'Nenhum histórico encontrado'}`
          }
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content?.trim();

    console.log('[ai-solution-suggester] Sugestão gerada para ticket:', ticket_id);

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('[ai-solution-suggester] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
