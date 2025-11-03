-- Criar enum para canais de atendimento
CREATE TYPE public.service_channel AS ENUM ('whatsapp', 'ligacao', 'visita_tecnica');

-- Criar tabela de registros diários
CREATE TABLE public.daily_service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  
  -- Informações do atendimento
  data_atendimento DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIME NOT NULL,
  hora_fim TIME,
  
  -- Canal de origem
  canal service_channel NOT NULL,
  
  -- Descrição do atendimento
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  solucao TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'pendente')),
  
  -- Observações adicionais
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_daily_records_company ON daily_service_records(company_id);
CREATE INDEX idx_daily_records_tecnico ON daily_service_records(tecnico_id);
CREATE INDEX idx_daily_records_data ON daily_service_records(data_atendimento);
CREATE INDEX idx_daily_records_canal ON daily_service_records(canal);

-- Trigger para updated_at
CREATE TRIGGER update_daily_service_records_updated_at
  BEFORE UPDATE ON daily_service_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE daily_service_records ENABLE ROW LEVEL SECURITY;

-- Bloquear acesso anônimo
CREATE POLICY "Block anonymous access to daily records"
  ON daily_service_records FOR ALL
  TO anon
  USING (false);

-- Admins podem ver tudo
CREATE POLICY "Admins can view all daily records"
  ON daily_service_records FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Usuários podem ver registros de sua empresa
CREATE POLICY "Users can view records from their company"
  ON daily_service_records FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Técnicos e admins podem criar registros
CREATE POLICY "Technicians can create daily records"
  ON daily_service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'tecnico'::user_role)
  );

-- Técnicos podem editar seus próprios registros, admins podem editar todos
CREATE POLICY "Technicians can update their own records"
  ON daily_service_records FOR UPDATE
  TO authenticated
  USING (
    tecnico_id = auth.uid() OR 
    is_admin(auth.uid())
  );

-- Apenas admins podem deletar
CREATE POLICY "Only admins can delete daily records"
  ON daily_service_records FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));