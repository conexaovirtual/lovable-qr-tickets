-- Remover política restritiva que está bloqueando acesso
DROP POLICY IF EXISTS "Block anonymous access to user_roles" ON public.user_roles;

-- Recriar a política de visualização para garantir que funciona
DROP POLICY IF EXISTS "View user roles policy" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    is_admin(auth.uid()) OR user_id = auth.uid()
  )
);