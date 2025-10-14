-- Create view for asset inventory by company
CREATE OR REPLACE VIEW asset_inventory_by_company AS
SELECT 
  c.id as company_id,
  c.nome_fantasia,
  c.cnpj,
  COUNT(a.id) as total_ativos,
  COUNT(a.id) FILTER (WHERE a.estado = 'em_uso') as ativos_em_uso,
  COUNT(a.id) FILTER (WHERE a.estado = 'estoque') as ativos_estoque,
  COUNT(a.id) FILTER (WHERE a.estado = 'manutencao') as ativos_manutencao,
  COUNT(a.id) FILTER (WHERE a.estado = 'baixado') as ativos_baixados,
  -- Por tipo
  COUNT(a.id) FILTER (WHERE a.tipo = 'desktop') as total_desktops,
  COUNT(a.id) FILTER (WHERE a.tipo = 'notebook') as total_notebooks,
  COUNT(a.id) FILTER (WHERE a.tipo = 'impressora') as total_impressoras,
  COUNT(a.id) FILTER (WHERE a.tipo = 'servidor') as total_servidores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'monitor') as total_monitores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'roteador') as total_roteadores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'switch') as total_switches,
  COUNT(a.id) FILTER (WHERE a.tipo = 'periferico') as total_perifericos,
  -- Configurações médias
  AVG((a.configuracoes->>'memoria_ram_gb')::numeric) FILTER (WHERE a.configuracoes->>'memoria_ram_gb' IS NOT NULL) as media_ram_gb,
  AVG((a.configuracoes->>'armazenamento_principal_gb')::numeric) FILTER (WHERE a.configuracoes->>'armazenamento_principal_gb' IS NOT NULL) as media_armazenamento_gb,
  -- Garantias
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim::date > CURRENT_DATE) as ativos_em_garantia,
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim::date <= CURRENT_DATE) as ativos_fora_garantia,
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim::date > CURRENT_DATE AND a.garantia_fim::date <= CURRENT_DATE + INTERVAL '90 days') as ativos_garantia_expirando
FROM companies c
LEFT JOIN assets a ON a.company_id = c.id
WHERE c.status = true
GROUP BY c.id, c.nome_fantasia, c.cnpj
ORDER BY c.nome_fantasia;

-- Enable RLS on the view
ALTER VIEW asset_inventory_by_company OWNER TO postgres;

-- Grant access to authenticated users
GRANT SELECT ON asset_inventory_by_company TO authenticated;