-- Adicionar coluna para vincular visita com OS criada
ALTER TABLE visit_schedules 
ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;

-- Indice para consultas
CREATE INDEX idx_visit_schedules_service_order ON visit_schedules(service_order_id);

-- Comentario
COMMENT ON COLUMN visit_schedules.service_order_id IS 
  'Ordem de servico criada automaticamente para esta visita';