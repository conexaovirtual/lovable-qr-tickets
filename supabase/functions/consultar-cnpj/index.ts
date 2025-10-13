import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrasilAPIResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove formatação do CNPJ (pontos, barras, hífens)
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

    // Valida se tem 14 dígitos
    if (cnpjLimpo.length !== 14) {
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Consultando CNPJ: ${cnpjLimpo}`);

    // Consulta BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'CNPJ não encontrado na Receita Federal' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`BrasilAPI retornou status ${response.status}`);
    }

    const data: BrasilAPIResponse = await response.json();

    // Formata endereço completo
    const enderecoCompleto = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      `${data.municipio}/${data.uf}`,
      `CEP: ${data.cep}`
    ].filter(Boolean).join(', ');

    // Formata telefone (adiciona parênteses no DDD se houver)
    let telefoneFormatado = '';
    if (data.ddd_telefone_1) {
      const telefone = data.ddd_telefone_1.replace(/[^\d]/g, '');
      if (telefone.length >= 10) {
        const ddd = telefone.substring(0, 2);
        const numero = telefone.substring(2);
        telefoneFormatado = `(${ddd}) ${numero}`;
      } else {
        telefoneFormatado = data.ddd_telefone_1;
      }
    }

    const resultado = {
      cnpj: data.cnpj,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || data.razao_social,
      endereco_completo: enderecoCompleto,
      telefone: telefoneFormatado,
      email: data.email || '',
      situacao_cadastral: data.descricao_situacao_cadastral,
      ativa: data.descricao_situacao_cadastral?.toUpperCase() === 'ATIVA',
    };

    console.log('Consulta realizada com sucesso:', resultado.razao_social);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao consultar CNPJ:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao consultar CNPJ. Serviço temporariamente indisponível.',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
