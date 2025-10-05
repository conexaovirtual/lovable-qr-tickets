-- Fix: Recreate companies_basic view with SECURITY INVOKER
-- This ensures the view respects RLS policies and uses the permissions of the querying user

DROP VIEW IF EXISTS public.companies_basic;

CREATE OR REPLACE VIEW public.companies_basic
WITH (security_invoker=on)
AS
SELECT
  id,
  nome_fantasia,
  status,
  created_at
FROM public.companies;

COMMENT ON VIEW public.companies_basic IS 
'Limited company information for regular users (hides PII like CNPJ, email, phone, address). Uses SECURITY INVOKER to respect RLS policies.';