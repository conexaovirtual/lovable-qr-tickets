-- Fase 1: Adicionar índices para otimização de performance
-- Índices para tabela tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON tickets(prioridade);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante_id ON tickets(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tecnico_id ON tickets(tecnico_id);

-- Índices para tabela service_orders
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_data_agendada ON service_orders(data_agendada);
CREATE INDEX IF NOT EXISTS idx_service_orders_company_id ON service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_tecnico_id ON service_orders(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at DESC);

-- Índices para tabela assets
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_tipo ON assets(tipo);
CREATE INDEX IF NOT EXISTS idx_assets_estado ON assets(estado);

-- Índices para tabela daily_service_records
CREATE INDEX IF NOT EXISTS idx_daily_service_records_data ON daily_service_records(data_atendimento DESC);
CREATE INDEX IF NOT EXISTS idx_daily_service_records_tecnico ON daily_service_records(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_daily_service_records_company ON daily_service_records(company_id);

-- Índices para tabela companies
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_nome_fantasia ON companies(nome_fantasia);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_tickets_company_status ON tickets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_service_orders_company_status ON service_orders(company_id, status);