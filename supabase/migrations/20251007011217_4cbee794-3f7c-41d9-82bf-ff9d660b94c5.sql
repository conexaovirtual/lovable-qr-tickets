-- Create view for company statistics
CREATE OR REPLACE VIEW company_statistics AS
SELECT 
  c.id as company_id,
  c.nome_fantasia,
  c.cnpj,
  c.status,
  c.sla_primeiro_atendimento_horas,
  c.sla_solucao_horas,
  COUNT(DISTINCT a.id) as total_ativos,
  COUNT(DISTINCT CASE WHEN a.estado = 'em_uso' THEN a.id END) as ativos_em_uso,
  COUNT(DISTINCT CASE WHEN a.estado = 'manutencao' THEN a.id END) as ativos_manutencao,
  COUNT(DISTINCT CASE WHEN a.estado = 'estoque' THEN a.id END) as ativos_estoque,
  COUNT(DISTINCT CASE WHEN a.estado = 'baixado' THEN a.id END) as ativos_baixados,
  COUNT(DISTINCT t.id) as total_tickets,
  COUNT(DISTINCT CASE WHEN t.status = 'novo' THEN t.id END) as tickets_novos,
  COUNT(DISTINCT CASE WHEN t.status = 'em_atendimento' THEN t.id END) as tickets_em_atendimento,
  COUNT(DISTINCT CASE WHEN t.status = 'resolvido' THEN t.id END) as tickets_resolvidos,
  COUNT(DISTINCT CASE WHEN t.status = 'fechado' THEN t.id END) as tickets_fechados,
  COUNT(DISTINCT CASE WHEN t.sla_solucao_limite < NOW() AND t.status NOT IN ('resolvido', 'fechado') THEN t.id END) as tickets_sla_violado,
  ROUND(AVG(t.avaliacao), 2) as media_avaliacao,
  ROUND(AVG(EXTRACT(EPOCH FROM (t.data_solucao - t.created_at))/3600), 2) as tempo_medio_resolucao_horas
FROM companies c
LEFT JOIN assets a ON a.company_id = c.id
LEFT JOIN tickets t ON t.company_id = c.id
GROUP BY c.id, c.nome_fantasia, c.cnpj, c.status, c.sla_primeiro_atendimento_horas, c.sla_solucao_horas;

-- Enable RLS on the view
ALTER VIEW company_statistics SET (security_invoker = true);