-- Phase 1: Fix Tickets RLS Policies to use has_role() instead of profiles.role
-- Drop existing policies that use deprecated profiles.role checks
DROP POLICY IF EXISTS "Users can view tickets from their company" ON public.tickets;
DROP POLICY IF EXISTS "Technicians and admins can update tickets" ON public.tickets;

-- Create updated policies using has_role() and is_admin()
CREATE POLICY "Users can view tickets from their company"
ON public.tickets
FOR SELECT
USING (
  -- Users can see tickets from their company
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
  OR
  -- Admins and technicians can see all tickets
  is_admin(auth.uid())
  OR
  has_role(auth.uid(), 'tecnico')
);

CREATE POLICY "Authorized users can update tickets"
ON public.tickets
FOR UPDATE
USING (
  is_admin(auth.uid())
  OR
  has_role(auth.uid(), 'tecnico')
  OR
  has_role(auth.uid(), 'gestor_cliente')
);

-- Phase 3: Strengthen PII Protection
-- Update profiles RLS to prevent cross-company enumeration
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own profile
  auth.uid() = id
  OR
  -- Admins can see all profiles
  is_admin(auth.uid())
  OR
  -- Users can see profiles from their own company only
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ) AND company_id IS NOT NULL)
);

-- Add column-level security for sensitive asset fields
-- Drop existing asset view policy and recreate with field restrictions
DROP POLICY IF EXISTS "Users can view assets from their company" ON public.assets;

CREATE POLICY "Users can view assets from their company"
ON public.assets
FOR SELECT
USING (
  -- Same company access or admin/tech access
  (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
  OR
  is_admin(auth.uid())
  OR
  has_role(auth.uid(), 'tecnico')
);

-- Create function to sanitize sensitive asset fields based on role
CREATE OR REPLACE FUNCTION public.can_view_asset_details(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) 
    OR has_role(_user_id, 'gestor_cliente');
$$;

-- Note: Column-level RLS would require PostgreSQL 15+, so we document this for application-level filtering
-- Application code should check can_view_asset_details() before displaying:
-- - local (location)
-- - numero_serie (serial number)
-- For tickets, financial data (custo_pecas, tempo_gasto_horas) should only be shown to admins and gestor_cliente

-- Create function to check if user can view financial data
CREATE OR REPLACE FUNCTION public.can_view_financial_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) 
    OR has_role(_user_id, 'gestor_cliente');
$$;