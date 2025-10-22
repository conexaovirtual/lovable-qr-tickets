-- Adicionar novos campos para agendamento na tabela service_orders
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS data_agendada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_agendada TIME,
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT CHECK (tipo_servico IN ('corretivo', 'preventivo', 'instalacao', 'consultoria')),
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  ADD COLUMN IF NOT EXISTS endereco_atendimento TEXT,
  ADD COLUMN IF NOT EXISTS contato_local TEXT,
  ADD COLUMN IF NOT EXISTS telefone_contato TEXT,
  ADD COLUMN IF NOT EXISTS equipamentos_necessarios TEXT[],
  ADD COLUMN IF NOT EXISTS pecas_previstas JSONB,
  ADD COLUMN IF NOT EXISTS tempo_estimado_horas NUMERIC(10,2);

-- Atualizar constraint de status para incluir novos estados
ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS service_orders_status_check,
  ADD CONSTRAINT service_orders_status_check 
    CHECK (status IN ('agendada', 'confirmada', 'em_execucao', 'executada', 'finalizada', 'cancelada'));

-- Tornar ticket_id opcional (OS pode existir sem chamado)
ALTER TABLE service_orders
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_orders_data_agendada ON service_orders(data_agendada);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_tecnico_data ON service_orders(tecnico_id, data_agendada);

-- Criar tabela de histórico de alterações
CREATE TABLE IF NOT EXISTS service_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela de histórico
ALTER TABLE service_order_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_order_history
CREATE POLICY "Users can view history from their company's service orders"
  ON service_order_history
  FOR SELECT
  USING (
    service_order_id IN (
      SELECT id FROM service_orders
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'tecnico'::user_role)
  );

CREATE POLICY "Authorized users can create history entries"
  ON service_order_history
  FOR INSERT
  WITH CHECK (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'tecnico'::user_role)
    OR has_role(auth.uid(), 'gestor_cliente'::user_role)
  );

-- Criar índice para histórico
CREATE INDEX IF NOT EXISTS idx_so_history_service_order ON service_order_history(service_order_id);

-- Atualizar status padrão para agendada
ALTER TABLE service_orders ALTER COLUMN status SET DEFAULT 'agendada';