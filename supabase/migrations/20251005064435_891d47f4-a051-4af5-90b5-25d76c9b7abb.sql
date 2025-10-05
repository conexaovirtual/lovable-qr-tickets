-- Add RLS policies for companies table to allow admin_provedor to manage companies
CREATE POLICY "Admin can insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin_provedor'
  )
);

CREATE POLICY "Admin can update companies" 
ON public.companies 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin_provedor'
  )
);

CREATE POLICY "Admin can delete companies" 
ON public.companies 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin_provedor'
  )
);

-- Update assets INSERT policy to allow admin_provedor and tecnico to insert assets for any company
DROP POLICY IF EXISTS "Admins and technicians can manage assets" ON public.assets;

CREATE POLICY "Admins and technicians can insert assets" 
ON public.assets 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico', 'gestor_cliente')
  )
);

CREATE POLICY "Admins and technicians can update assets" 
ON public.assets 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico', 'gestor_cliente')
  )
);

CREATE POLICY "Admins and technicians can delete assets" 
ON public.assets 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico', 'gestor_cliente')
  )
);