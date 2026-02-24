import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente virtual da Conexão Virtual Soluções Tecnológicas, uma empresa especializada em suporte e manutenção de computadores, notebooks, redes, impressoras e periféricos.

Suas responsabilidades:
- Fazer triagem inicial do problema do cliente
- Sugerir soluções simples que o cliente pode tentar (reiniciar, verificar cabos, etc.)
- Coletar informações sobre o equipamento (marca, modelo, sintomas)
- Classificar a urgência do chamado (baixa, média, alta)
- Agendar visitas técnicas quando necessário
- Fornecer estimativas de tempo e custo quando possível

Regras:
- Seja sempre educado, profissional e empático
- Use linguagem simples, evite jargão técnico excessivo
- Responda em português brasileiro
- Seja conciso mas completo
- Se não souber resolver, encaminhe para um técnico humano
- Sempre pergunte o nome do cliente se ainda não souber
- Ao final da triagem, resuma: problema, equipamento, urgência e próximos passos

Serviços oferecidos:
- Formatação e instalação de sistemas operacionais
- Remoção de vírus e malware
- Manutenção preventiva e corretiva
- Upgrade de hardware (memória, SSD, etc.)
- Configuração de redes Wi-Fi e cabeadas
- Suporte a impressoras e periféricos
- Backup e recuperação de dados
- Montagem de computadores sob medida`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
