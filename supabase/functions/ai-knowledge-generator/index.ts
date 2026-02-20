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
    const { ticket_id, daily_record_id } = await req.json();
    if (!ticket_id && !daily_record_id) throw new Error('ticket_id or daily_record_id is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let titulo = '';
    let descricao = '';
    let solucao = '';
    let empresaNome = 'N/A';
    let ativoInfo = 'N/A';
    const sourceId = ticket_id || daily_record_id;

    if (daily_record_id) {
      const { data: record, error } = await supabase
        .from('daily_service_records')
        .select(`*, companies(nome_fantasia), assets(tipo, nome, fabricante, modelo)`)
        .eq('id', daily_record_id)
        .single();

      if (error || !record) throw new Error('Atendimento não encontrado');
      if (!record.solucao) throw new Error('Atendimento sem solução documentada');

      titulo = record.titulo;
      descricao = record.descricao;
      solucao = record.solucao;
      empresaNome = record.companies?.nome_fantasia || 'N/A';
      if (record.assets) ativoInfo = `${record.assets.tipo} - ${record.assets.nome}`;
    } else {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`*, companies(nome_fantasia), assets(tipo, nome, fabricante, modelo)`)
        .eq('id', ticket_id)
        .single();

      if (error || !ticket) throw new Error('Ticket não encontrado');
      if (!ticket.solucao) throw new Error('Ticket sem solução documentada');

      titulo = ticket.titulo;
      descricao = ticket.descricao;
      solucao = ticket.solucao;
      empresaNome = ticket.companies?.nome_fantasia || 'N/A';
      if (ticket.assets) ativoInfo = `${ticket.assets.tipo} - ${ticket.assets.nome}`;
    }

    // Verificar se já existe artigo para esta fonte
    const { data: existing } = await supabase
      .from('knowledge_articles')
      .select('id')
      .eq('ticket_id', sourceId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: 'Artigo já existe', article_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chamar IA para gerar artigo
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
            content: `Você é um redator técnico de TI. Transforme tickets resolvidos em artigos de base de conhecimento.
Responda em JSON válido:
{
  "titulo": "Título claro e pesquisável do artigo",
  "problema": "Descrição objetiva do problema (2-4 frases)",
  "solucao": "Passos detalhados da solução em formato de lista numerada",
  "tags": ["tag1", "tag2", "tag3"],
  "categoria": "categoria do problema"
}
As tags devem ser palavras-chave úteis para busca. A categoria deve ser uma das: Hardware, Software, Rede, Segurança, Impressão, Email, Backup, Acesso, Sistema Operacional, Outros.`
          },
          {
            role: "user",
            content: `Transforme este atendimento resolvido em artigo:
Título: ${titulo}
Descrição: ${descricao}
Solução: ${solucao}
Empresa: ${empresaNome}
Ativo: ${ativoInfo}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    let article;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      article = JSON.parse(jsonMatch![0]);
    } catch {
      article = {
        titulo: titulo,
        problema: descricao.substring(0, 500),
        solucao: solucao,
        tags: [],
        categoria: 'Outros'
      };
    }

    // Salvar artigo
    const { data: newArticle, error: insertError } = await supabase
      .from('knowledge_articles')
      .insert({
        ticket_id: sourceId,
        titulo: article.titulo,
        problema: article.problema,
        solucao: article.solucao,
        tags: article.tags || [],
        categoria: article.categoria || 'Outros',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('[ai-knowledge-generator] Article created:', newArticle.id);

    return new Response(JSON.stringify({ article: newArticle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('[ai-knowledge-generator] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
