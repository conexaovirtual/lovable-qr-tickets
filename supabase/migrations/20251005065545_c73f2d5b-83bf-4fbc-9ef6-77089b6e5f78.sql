-- ====================================
-- FIX: Update RLS Policies to use user_roles table
-- ====================================

-- ============ COMPANIES TABLE ============

-- Drop old policies that check profiles.role
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Admin can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Admin can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admin can update companies" ON public.companies;
DROP POLICY IF EXISTS "Admin can delete companies" ON public.companies;

-- Create new policies using SECURITY DEFINER functions
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============ ASSETS TABLE ============

-- Drop old policies that check profiles.role
DROP POLICY IF EXISTS "Users can view assets from their company" ON public.assets;
DROP POLICY IF EXISTS "Admins and technicians can insert assets" ON public.assets;
DROP POLICY IF EXISTS "Admins and technicians can update assets" ON public.assets;
DROP POLICY IF EXISTS "Admins and technicians can delete assets" ON public.assets;

-- Create new policies using SECURITY DEFINER functions
CREATE POLICY "Users can view assets from their company"
ON public.assets
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico')
);

CREATE POLICY "Authorized users can insert assets"
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico')
  OR public.has_role(auth.uid(), 'gestor_cliente')
);

CREATE POLICY "Authorized users can update assets"
ON public.assets
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico')
  OR public.has_role(auth.uid(), 'gestor_cliente')
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico')
  OR public.has_role(auth.uid(), 'gestor_cliente')
);

CREATE POLICY "Authorized users can delete assets"
ON public.assets
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico')
  OR public.has_role(auth.uid(), 'gestor_cliente')
);