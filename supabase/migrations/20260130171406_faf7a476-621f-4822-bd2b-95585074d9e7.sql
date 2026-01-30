-- Tabela para resumos IA
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('ticket', 'daily_service')),
  source_id UUID NOT NULL,
  resumo TEXT NOT NULL,
  problema_identificado TEXT,
  solucao_aplicada TEXT,
  tempo_estimado_futuro TEXT,
  padrao_detectado BOOLEAN DEFAULT FALSE,
  recomendacao_preventiva TEXT,
  tags_sugeridas TEXT[],
  padroes JSONB,
  recomendacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_source ON public.ai_summaries(source_type, source_id);

-- Tabela para alertas inteligentes
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL CHECK (severidade IN ('alta', 'media', 'baixa')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  dados JSONB,
  acao_sugerida TEXT,
  lido BOOLEAN DEFAULT FALSE,
  resolvido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_tipo ON public.ai_alerts(tipo);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_lido ON public.ai_alerts(lido, resolvido);

-- Tabela para cache de previsoes
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  probabilidade_falha INTEGER CHECK (probabilidade_falha >= 0 AND probabilidade_falha <= 100),
  tipo_falha_prevista TEXT,
  dias_estimados INTEGER,
  historico_resumo TEXT,
  recomendacao TEXT,
  valido_ate TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_asset ON public.ai_predictions(asset_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_validade ON public.ai_predictions(valido_ate);

-- RLS Policies
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

-- Policies para ai_summaries
CREATE POLICY "Admins and technicians can manage ai_summaries" ON public.ai_summaries
  FOR ALL USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'tecnico')
  );

-- Policies para ai_alerts
CREATE POLICY "Admins and technicians can manage ai_alerts" ON public.ai_alerts
  FOR ALL USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'tecnico')
  );

-- Policies para ai_predictions
CREATE POLICY "Admins and technicians can manage ai_predictions" ON public.ai_predictions
  FOR ALL USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'tecnico')
  );