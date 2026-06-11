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
    const { ticket_id, descricao } = await req.json();
    if (!ticket_id || !descricao) throw new Error('ticket_id and descricao are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar info do ativo vinculado ao ticket
    const { data: ticket } = await supabase
      .from('tickets')
      .select('assets(tipo, nome, fabricante, modelo)')
      .eq('id', ticket_id)
      .single();

    const assetInfo = ticket?.assets
      ? `${(ticket.assets as any).tipo} - ${(ticket.assets as any).nome}`
      : null;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de suporte técnico. Um usuário abriu um chamado de TI. Gere uma resposta amigável e útil com:
1. Confirmação de recebimento
2. 2-3 passos preliminares simples que o usuário pode tentar enquanto aguarda o técnico
3. Orientação para não desligar/reiniciar caso o problema possa perder dados

A resposta deve ser curta (máx 120 palavras), amigável, e em português brasileiro.
Responda APENAS com o texto da mensagem.`
          },
          {
            role: "user",
            content: `Descrição do problema: ${descricao}
${assetInfo ? `Equipamento: ${assetInfo}` : ''}`
          }
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      console.error('[ai-auto-response] AI error:', aiResponse.status);
      // Não falhar silenciosamente - usar resposta padrão
      const defaultResponse = "Seu chamado foi recebido com sucesso! Nossa equipe técnica já foi notificada e entrará em contato em breve. Enquanto aguarda, evite desligar ou reiniciar o equipamento para preservar informações úteis para o diagnóstico.";
      
      await supabase.from('ticket_comments').insert({
        ticket_id,
        user_id: '00000000-0000-0000-0000-000000000000',
        comentario: `🤖 **Resposta Automática:**\n\n${defaultResponse}`,
        is_internal: false,
      });

      return new Response(JSON.stringify({ response: defaultResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const autoResponse = aiData.choices?.[0]?.message?.content?.trim();

    // Salvar como comentário no ticket (usando service role - bypass RLS)
    const { error: commentError } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id,
        user_id: '00000000-0000-0000-0000-000000000000',
        comentario: `🤖 **Resposta Automática:**\n\n${autoResponse}`,
        is_internal: false,
      });

    if (commentError) {
      console.error('[ai-auto-response] Comment insert error:', commentError);
    }

    console.log('[ai-auto-response] Auto response for ticket:', ticket_id);

    return new Response(JSON.stringify({ response: autoResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('[ai-auto-response] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
