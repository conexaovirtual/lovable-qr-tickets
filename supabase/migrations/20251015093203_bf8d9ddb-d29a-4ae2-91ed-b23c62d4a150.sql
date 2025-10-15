-- =====================================================
-- CRITICAL SECURITY FIXES - Migration (Final Version)
-- =====================================================
-- This migration addresses 3 critical security issues:
-- 1. Broken audit logging system
-- 2. Exposed database views (using security barriers)
-- 3. Security monitoring infrastructure
-- =====================================================

-- ========================================
-- PART 1: Fix Audit Logging System
-- ========================================

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_severity text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Input validation
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'event_type cannot be null or empty';
  END IF;
  
  IF p_severity NOT IN ('info', 'warn', 'error', 'critical') THEN
    RAISE EXCEPTION 'severity must be one of: info, warn, error, critical';
  END IF;
  
  -- Insert audit log (DEFINER function bypasses RLS)
  INSERT INTO public.security_audit_logs (
    event_type,
    user_id,
    ip_address,
    user_agent,
    metadata,
    severity
  )
  VALUES (
    p_event_type,
    p_user_id,
    p_ip,
    p_user_agent,
    COALESCE(p_metadata, '{}'::jsonb),
    p_severity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event TO authenticated, anon;

COMMENT ON FUNCTION public.log_security_event IS 
'Safely logs security events bypassing RLS. Used by Edge Functions and triggers for audit trail.';

-- ========================================
-- PART 2: Secure asset_inventory_by_company
-- ========================================

DROP VIEW IF EXISTS public.asset_inventory_by_company CASCADE;

CREATE VIEW public.asset_inventory_by_company
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  c.id as company_id,
  c.nome_fantasia,
  c.cnpj,
  COUNT(a.id) as total_ativos,
  COUNT(a.id) FILTER (WHERE a.estado = 'em_uso') as ativos_em_uso,
  COUNT(a.id) FILTER (WHERE a.estado = 'estoque') as ativos_estoque,
  COUNT(a.id) FILTER (WHERE a.estado = 'manutencao') as ativos_manutencao,
  COUNT(a.id) FILTER (WHERE a.estado = 'baixado') as ativos_baixados,
  COUNT(a.id) FILTER (WHERE a.tipo = 'desktop') as total_desktops,
  COUNT(a.id) FILTER (WHERE a.tipo = 'notebook') as total_notebooks,
  COUNT(a.id) FILTER (WHERE a.tipo = 'impressora') as total_impressoras,
  COUNT(a.id) FILTER (WHERE a.tipo = 'servidor') as total_servidores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'monitor') as total_monitores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'switch') as total_switches,
  COUNT(a.id) FILTER (WHERE a.tipo = 'roteador') as total_roteadores,
  COUNT(a.id) FILTER (WHERE a.tipo = 'periferico') as total_perifericos,
  AVG((a.configuracoes->>'memoria_ram_gb')::int) FILTER (WHERE a.configuracoes->>'memoria_ram_gb' IS NOT NULL) as media_ram_gb,
  AVG((a.configuracoes->>'armazenamento_principal_gb')::int) FILTER (WHERE a.configuracoes->>'armazenamento_principal_gb' IS NOT NULL) as media_armazenamento_gb,
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim > CURRENT_DATE) as ativos_em_garantia,
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim <= CURRENT_DATE) as ativos_fora_garantia,
  COUNT(a.id) FILTER (WHERE a.garantia_fim IS NOT NULL AND a.garantia_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days') as ativos_garantia_expirando
FROM companies c
LEFT JOIN assets a ON a.company_id = c.id
WHERE c.status = true
  AND (
    c.id = get_user_company_id(auth.uid())
    OR is_admin(auth.uid())
    OR (has_role(auth.uid(), 'gestor_cliente'::user_role) AND c.id = get_user_company_id(auth.uid()))
  )
GROUP BY c.id, c.nome_fantasia, c.cnpj
ORDER BY c.nome_fantasia;

COMMENT ON VIEW public.asset_inventory_by_company IS
'Secure view of asset inventory by company. Security barrier enforces row-level filtering.';

-- ========================================
-- PART 3: Secure company_statistics
-- ========================================

DROP VIEW IF EXISTS public.company_statistics CASCADE;

CREATE VIEW public.company_statistics
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  c.id as company_id,
  c.nome_fantasia,
  c.cnpj,
  c.status,
  c.sla_primeiro_atendimento_horas,
  c.sla_solucao_horas,
  COUNT(t.id) as total_tickets,
  COUNT(t.id) FILTER (WHERE t.status = 'novo') as tickets_novos,
  COUNT(t.id) FILTER (WHERE t.status = 'em_atendimento') as tickets_em_atendimento,
  COUNT(t.id) FILTER (WHERE t.status = 'resolvido') as tickets_resolvidos,
  COUNT(t.id) FILTER (WHERE t.status = 'fechado') as tickets_fechados,
  COUNT(t.id) FILTER (WHERE t.data_solucao > t.sla_solucao_limite) as tickets_sla_violado,
  AVG(t.avaliacao) as media_avaliacao,
  AVG(EXTRACT(EPOCH FROM (t.data_solucao - t.created_at)) / 3600) FILTER (WHERE t.data_solucao IS NOT NULL) as tempo_medio_resolucao_horas,
  COUNT(DISTINCT a.id) as total_ativos,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'em_uso') as ativos_em_uso,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'manutencao') as ativos_manutencao,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'estoque') as ativos_estoque,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'baixado') as ativos_baixados
FROM companies c
LEFT JOIN tickets t ON t.company_id = c.id
LEFT JOIN assets a ON a.company_id = c.id
WHERE c.status = true
  AND (
    c.id = get_user_company_id(auth.uid())
    OR is_admin(auth.uid())
    OR (has_role(auth.uid(), 'gestor_cliente'::user_role) AND c.id = get_user_company_id(auth.uid()))
  )
GROUP BY c.id, c.nome_fantasia, c.cnpj, c.status, c.sla_primeiro_atendimento_horas, c.sla_solucao_horas
ORDER BY c.nome_fantasia;

COMMENT ON VIEW public.company_statistics IS 
'Secure view of company operational metrics. Sensitive data restricted to company owners and admins.';

-- ========================================
-- PART 4: Secure companies_basic
-- ========================================

DROP VIEW IF EXISTS public.companies_basic CASCADE;

CREATE VIEW public.companies_basic
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  id,
  nome_fantasia,
  status,
  created_at
FROM companies
WHERE status = true
  AND (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR is_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'tecnico'::user_role)
      AND id IN (SELECT DISTINCT company_id FROM tickets WHERE tecnico_id = auth.uid())
    )
  );

COMMENT ON VIEW public.companies_basic IS
'Secure basic view of companies. Restricted to prevent enumeration attacks.';

-- ========================================
-- PART 5: Secure companies_safe
-- ========================================

DROP VIEW IF EXISTS public.companies_safe CASCADE;

CREATE VIEW public.companies_safe
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  c.id,
  c.nome_fantasia,
  c.razao_social,
  CASE 
    WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid())
    THEN c.cnpj
    ELSE NULL
  END as cnpj,
  CASE 
    WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid())
    THEN c.email
    ELSE NULL
  END as email,
  CASE 
    WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid())
    THEN c.telefone
    ELSE NULL
  END as telefone,
  c.endereco,
  c.sla_primeiro_atendimento_horas,
  c.sla_solucao_horas,
  c.status,
  c.created_at,
  c.updated_at
FROM companies c
WHERE c.status = true
  AND (
    c.id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR is_admin(auth.uid())
  );

COMMENT ON VIEW public.companies_safe IS
'Secure company view with field-level masking. Sensitive fields only visible to admins.';

-- ========================================
-- PART 6: Security Monitoring View
-- ========================================

CREATE OR REPLACE VIEW public.security_rls_violations
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  event_type,
  user_id,
  ip_address,
  user_agent,
  metadata,
  severity,
  created_at
FROM public.security_audit_logs
WHERE 
  (
    event_type LIKE '%denied%' 
    OR event_type LIKE '%rls_violation%'
    OR event_type LIKE '%unauthorized%'
    OR severity IN ('error', 'critical')
  )
  AND is_admin(auth.uid())
ORDER BY created_at DESC;

COMMENT ON VIEW public.security_rls_violations IS
'Security monitoring view. Admin-only access for RLS violations and suspicious activity.';

-- ========================================
-- PART 7: Documentation Update
-- ========================================

COMMENT ON POLICY "Service role can insert audit logs" ON public.security_audit_logs IS
'DEPRECATED: Use log_security_event() function instead.';

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SECURITY FIXES APPLIED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 1. Audit logging function created: log_security_event()';
  RAISE NOTICE '✅ 2. asset_inventory_by_company secured with security_barrier';
  RAISE NOTICE '✅ 3. company_statistics secured with security_barrier';
  RAISE NOTICE '✅ 4. companies_basic secured with security_barrier';
  RAISE NOTICE '✅ 5. companies_safe enhanced with field-level masking';
  RAISE NOTICE '✅ 6. security_rls_violations monitoring view created';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '   - Update Edge Function to use log_security_event()';
  RAISE NOTICE '   - Fix SQL injection in CompanyDialog.tsx';
  RAISE NOTICE '   - Test security improvements';
  RAISE NOTICE '';
END $$;