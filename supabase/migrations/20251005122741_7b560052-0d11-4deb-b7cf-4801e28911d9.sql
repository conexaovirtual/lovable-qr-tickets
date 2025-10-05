-- ==========================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ==========================================

-- 1.1 Phone Privacy (Database-Level Protection)
-- Create security definer function to check phone visibility
CREATE OR REPLACE FUNCTION public.can_view_phone(
  target_user_id UUID,
  viewer_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile RECORD;
  viewer_profile RECORD;
  viewer_roles user_role[];
BEGIN
  -- Get target user's profile
  SELECT company_id, phone_visibility INTO target_profile
  FROM profiles WHERE id = target_user_id;
  
  -- Get viewer's profile
  SELECT company_id INTO viewer_profile
  FROM profiles WHERE id = viewer_user_id;
  
  -- Get viewer's roles
  SELECT array_agg(role) INTO viewer_roles
  FROM user_roles WHERE user_id = viewer_user_id;
  
  -- No viewer profile = no access
  IF viewer_profile IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admins can always view
  IF 'admin_provedor' = ANY(viewer_roles) THEN
    RETURN TRUE;
  END IF;
  
  -- Same user can view their own
  IF target_user_id = viewer_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Different company = cannot view
  IF target_profile.company_id != viewer_profile.company_id THEN
    RETURN FALSE;
  END IF;
  
  -- Apply visibility rules
  CASE COALESCE(target_profile.phone_visibility, 'everyone')
    WHEN 'everyone' THEN
      RETURN TRUE;
    WHEN 'managers_only' THEN
      RETURN 'gestor_cliente' = ANY(viewer_roles) OR 'admin_provedor' = ANY(viewer_roles);
    WHEN 'private' THEN
      RETURN FALSE;
    ELSE
      RETURN TRUE; -- Default to everyone for backwards compatibility
  END CASE;
END;
$$;

-- Create safe profiles view with phone masking
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  p.id,
  p.nome,
  p.company_id,
  p.avatar_url,
  p.phone_visibility,
  p.created_at,
  p.updated_at,
  CASE 
    WHEN can_view_phone(p.id, auth.uid()) THEN p.telefone
    ELSE '••• •••• ••••'
  END AS telefone
FROM profiles p;

-- Grant access to profiles_safe
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Add RLS to profiles_safe (same company access rules)
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- 1.2 Company Data Restriction
-- Create restricted companies view for regular users
CREATE OR REPLACE VIEW public.companies_safe AS
SELECT 
  c.id,
  c.nome_fantasia,
  c.status,
  c.created_at,
  c.updated_at,
  -- Sensitive fields only for admins and managers
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.razao_social
    ELSE NULL
  END AS razao_social,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.cnpj
    ELSE NULL
  END AS cnpj,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.email
    ELSE NULL
  END AS email,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.telefone
    ELSE NULL
  END AS telefone,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.endereco
    ELSE NULL
  END AS endereco,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.sla_primeiro_atendimento_horas
    ELSE NULL
  END AS sla_primeiro_atendimento_horas,
  CASE 
    WHEN can_view_financial_data(auth.uid()) THEN c.sla_solucao_horas
    ELSE NULL
  END AS sla_solucao_horas
FROM companies c
WHERE 
  -- Users can only see their own company OR admins can see all
  c.id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  OR is_admin(auth.uid());

-- Grant access to companies_safe
GRANT SELECT ON public.companies_safe TO authenticated;

-- Add RLS to companies_safe
ALTER VIEW public.companies_safe SET (security_invoker = true);

-- 1.3 Fix NULL company_id Issue
-- Create "Sistema Interno" company for admin/provider users
INSERT INTO public.companies (
  id,
  nome_fantasia,
  razao_social,
  status,
  sla_primeiro_atendimento_horas,
  sla_solucao_horas
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Sistema Interno',
  'Provedor de Serviços - Interno',
  true,
  4,
  16
)
ON CONFLICT (id) DO NOTHING;

-- Update handle_new_user trigger to assign company for admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user boolean;
  internal_company_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) = 0 INTO is_first_user FROM profiles;
  
  -- Insert profile
  INSERT INTO public.profiles (id, nome, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    CASE 
      WHEN is_first_user THEN internal_company_id
      ELSE NULL
    END
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    CASE 
      WHEN is_first_user THEN 'admin_provedor'::user_role
      ELSE 'solicitante'::user_role
    END
  );
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- PHASE 2: REMOVE REDUNDANT POLICIES
-- ==========================================

-- Remove old redundant "Users can view own profile" policy if it exists
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- ==========================================
-- PHASE 3: AUDIT LOGGING
-- ==========================================

-- Create audit log function for phone access attempts
CREATE OR REPLACE FUNCTION public.log_phone_access_attempt(
  target_user_id UUID,
  viewer_user_id UUID,
  access_granted BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log denied attempts or suspicious patterns
  IF NOT access_granted THEN
    INSERT INTO security_audit_logs (
      event_type,
      user_id,
      severity,
      metadata
    )
    VALUES (
      'phone_access_denied',
      viewer_user_id,
      'warning',
      jsonb_build_object(
        'target_user_id', target_user_id,
        'timestamp', NOW()
      )
    );
  END IF;
END;
$$;