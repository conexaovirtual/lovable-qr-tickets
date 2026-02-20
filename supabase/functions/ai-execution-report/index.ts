import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { titulo, descricao, tempo_gasto, observacoes, tipo_servico } = await req.json();

    if (!descricao) throw new Error('descricao is required');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

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
            content: `Você é um técnico de TI experiente. Reescreva a descrição de serviço fornecida de forma profissional, clara e padronizada.

A descrição deve:
- Ser objetiva e técnica
- Descrever os serviços realizados em formato estruturado
- Incluir diagnóstico, ações realizadas e resultado
- Ter entre 80 e 250 palavras
- Ser escrita em português brasileiro

Responda APENAS com o texto da descrição reescrita, sem formatação JSON, sem títulos.`
          },
          {
            role: "user",
            content: `Reescreva esta descrição de serviço:
Título: ${titulo || 'N/A'}
Tipo: ${tipo_servico || 'N/A'}
Descrição original: ${descricao}
Tempo gasto: ${tempo_gasto ? tempo_gasto + 'h' : 'N/A'}
Observações: ${observacoes || 'Nenhuma'}`
          }
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('[ai-execution-report] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
