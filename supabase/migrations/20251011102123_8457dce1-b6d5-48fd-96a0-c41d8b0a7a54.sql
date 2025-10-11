-- 1. Adicionar política para admins verem todas as roles de usuários
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- 2. Remover políticas SELECT redundantes em profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company with privacy rules" ON public.profiles;

-- 3. Criar política SELECT unificada e clara para profiles
CREATE POLICY "View profiles policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Admins veem todos os perfis
  is_admin(auth.uid())
  -- OU usuários veem perfis da mesma empresa
  OR company_id = get_user_company_id(auth.uid())
  -- OU veem perfis multi-empresa (técnicos sem empresa específica)
  OR company_id IS NULL
);

-- 4. Adicionar política DELETE para admins em profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));