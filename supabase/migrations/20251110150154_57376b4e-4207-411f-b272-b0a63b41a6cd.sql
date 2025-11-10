-- Criar tabela de cache para consultas CNPJ
CREATE TABLE IF NOT EXISTS public.cnpj_cache (
  cnpj TEXT PRIMARY KEY,
  dados JSONB NOT NULL,
  consultado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valido_ate TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Índice para verificar validade do cache
CREATE INDEX IF NOT EXISTS idx_cnpj_cache_validade ON public.cnpj_cache(valido_ate);

-- Habilitar RLS
ALTER TABLE public.cnpj_cache ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (usuários autenticados)
CREATE POLICY "Cache de CNPJ é público para leitura"
  ON public.cnpj_cache FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir inserção via service role (edge functions)
CREATE POLICY "Apenas edge functions podem inserir no cache"
  ON public.cnpj_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Política para permitir update via service role
CREATE POLICY "Apenas edge functions podem atualizar cache"
  ON public.cnpj_cache FOR UPDATE
  TO service_role
  USING (true);