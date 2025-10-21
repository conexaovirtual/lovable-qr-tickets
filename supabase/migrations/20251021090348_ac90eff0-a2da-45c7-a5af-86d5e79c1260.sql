-- Tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero_os INTEGER NOT NULL,
  tecnico_id UUID REFERENCES profiles(id),
  data_emissao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_execucao TIMESTAMPTZ,
  tempo_gasto_horas NUMERIC(10,2) DEFAULT 0,
  custo_pecas NUMERIC(10,2) DEFAULT 0,
  custo_total NUMERIC(10,2) DEFAULT 0,
  descricao_servicos TEXT NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'emitida' CHECK (status IN ('emitida', 'executada', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_service_orders_ticket ON service_orders(ticket_id);
CREATE INDEX idx_service_orders_company ON service_orders(company_id);
CREATE INDEX idx_service_orders_data_emissao ON service_orders(data_emissao);
CREATE INDEX idx_service_orders_numero ON service_orders(numero_os);

-- Sequência para numeração automática de OS
CREATE SEQUENCE IF NOT EXISTS service_orders_numero_seq START 1;

-- Habilitar Row Level Security
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Admins e técnicos podem criar OS
CREATE POLICY "Authorized users can create service orders"
  ON service_orders FOR INSERT
  WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'tecnico'::user_role) OR 
    has_role(auth.uid(), 'gestor_cliente'::user_role)
  );

-- Policy: Usuários podem ver OS de sua empresa
CREATE POLICY "Users can view service orders from their company"
  ON service_orders FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR
    is_admin(auth.uid()) OR
    has_role(auth.uid(), 'tecnico'::user_role)
  );

-- Policy: Admins e técnicos podem atualizar OS
CREATE POLICY "Authorized users can update service orders"
  ON service_orders FOR UPDATE
  USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'tecnico'::user_role) OR 
    has_role(auth.uid(), 'gestor_cliente'::user_role)
  );

-- Policy: Apenas admins podem deletar OS
CREATE POLICY "Only admins can delete service orders"
  ON service_orders FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger para auto-incremento do número da OS
CREATE OR REPLACE FUNCTION set_service_order_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_os IS NULL THEN
    NEW.numero_os := nextval('service_orders_numero_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_service_order_numero
  BEFORE INSERT ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_service_order_numero();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();