-- Remover políticas conflitantes em user_roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Criar política unificada para visualização de roles
CREATE POLICY "View user roles policy"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  -- Admins veem todas as roles
  is_admin(auth.uid())
  -- OU usuários veem apenas suas próprias roles
  OR user_id = auth.uid()
);