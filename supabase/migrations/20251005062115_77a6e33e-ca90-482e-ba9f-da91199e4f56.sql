-- CORREÇÃO DE SEGURANÇA: Prevenir que usuários alterem seus próprios roles
-- Remover política insegura que permite usuários atualizarem qualquer campo do próprio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Criar política segura: usuários podem atualizar apenas campos não-sensíveis
CREATE POLICY "Users can update their own non-sensitive profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Impede alteração de role
  AND company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) -- Impede alteração de company_id
);

-- Apenas administradores podem alterar roles e company_id de qualquer usuário
CREATE POLICY "Only admins can update user roles and company"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin_provedor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin_provedor'
  )
);