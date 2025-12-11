-- Atualizar políticas de empresas para permitir técnicos criar e editar

-- Remover políticas existentes de inserção e atualização
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can update companies" ON public.companies;

-- Criar novas políticas que incluem técnicos
CREATE POLICY "Admins and technicians can insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
);

CREATE POLICY "Admins and technicians can update companies" 
ON public.companies 
FOR UPDATE 
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
);

-- Permitir técnicos visualizarem todas as empresas
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;

CREATE POLICY "Admins and technicians can view all companies" 
ON public.companies 
FOR SELECT 
USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
);