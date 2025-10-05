-- Criar função security definer para verificar role sem recursão
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Remover políticas com possível recursão
DROP POLICY IF EXISTS "Users can update their own non-sensitive profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can update user roles and company" ON public.profiles;

-- Política segura: usuários podem atualizar apenas campos não-sensíveis (sem recursão)
CREATE POLICY "Users can update own profile non-sensitive fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = get_user_role(auth.uid()) -- Usa função ao invés de subquery
  AND company_id IS NOT DISTINCT FROM (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Apenas administradores podem alterar roles e company_id
CREATE POLICY "Admins can update all user profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'admin_provedor')
WITH CHECK (get_user_role(auth.uid()) = 'admin_provedor');

-- Inserir o primeiro administrador (usando o email do usuário que se cadastrou)
-- NOTA: Substituir este UPDATE com o ID correto do usuário
UPDATE public.profiles 
SET role = 'admin_provedor'
WHERE id = (
  SELECT id FROM public.profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);