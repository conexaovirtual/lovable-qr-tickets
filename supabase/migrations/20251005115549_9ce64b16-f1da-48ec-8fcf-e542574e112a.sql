-- Phase 1: Audit Log Write Protection
-- Add explicit policies to prevent tampering with audit logs
-- Only service role can write logs (through edge functions)

CREATE POLICY "Service role can insert audit logs"
ON public.security_audit_logs
FOR INSERT
WITH CHECK (false); -- Regular users cannot insert directly

CREATE POLICY "Service role can update audit logs"
ON public.security_audit_logs
FOR UPDATE
USING (false); -- No one can update audit logs

CREATE POLICY "Service role can delete audit logs"
ON public.security_audit_logs
FOR DELETE
USING (false); -- No one can delete audit logs

COMMENT ON POLICY "Service role can insert audit logs" ON public.security_audit_logs IS 
'Audit logs can only be written by service role through edge functions';

-- Phase 2: Company PII Field Restrictions
-- Create a view with limited company information for regular users

CREATE OR REPLACE VIEW public.companies_basic AS
SELECT
  id,
  nome_fantasia,
  status,
  created_at
FROM public.companies;

COMMENT ON VIEW public.companies_basic IS 
'Limited company information for regular users (hides PII like CNPJ, email, phone, address)';

-- Grant access to the view
GRANT SELECT ON public.companies_basic TO authenticated;

-- Phase 3: Privacy Enhancements
-- Add phone visibility preferences to profiles

CREATE TYPE public.phone_visibility AS ENUM ('everyone', 'managers_only', 'private');

ALTER TABLE public.profiles
ADD COLUMN phone_visibility phone_visibility DEFAULT 'everyone';

COMMENT ON COLUMN public.profiles.phone_visibility IS 
'Controls who can view this user''s phone number';

-- Update profiles RLS policy to respect phone visibility
-- First, drop the existing policy and recreate it with visibility logic
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

CREATE POLICY "Users can view profiles in their company with privacy rules"
ON public.profiles
FOR SELECT
USING (
  -- Admins can see everything
  is_admin(auth.uid())
  OR
  -- Users can see profiles in their company, but phone number is filtered by visibility
  (
    company_id IN (
      SELECT company_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  )
);

COMMENT ON POLICY "Users can view profiles in their company with privacy rules" ON public.profiles IS 
'Users can view profiles in their company. Phone visibility is controlled by phone_visibility column and filtered in application layer for managers_only/private settings';

-- Phase 5: JSONB Validation for Assets
-- Add a constraint to ensure configuracoes follows expected schema

ALTER TABLE public.assets
ADD CONSTRAINT configuracoes_schema_check
CHECK (
  configuracoes IS NULL OR (
    jsonb_typeof(configuracoes) = 'object'
  )
);

COMMENT ON CONSTRAINT configuracoes_schema_check ON public.assets IS 
'Ensures configuracoes is either NULL or a valid JSON object';