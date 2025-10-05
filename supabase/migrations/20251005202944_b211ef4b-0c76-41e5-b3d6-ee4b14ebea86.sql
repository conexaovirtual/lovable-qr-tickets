-- Remover política antiga que bloqueia admins/técnicos
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;

-- Nova política que permite:
-- 1. Admins criar para qualquer empresa
-- 2. Técnicos criar para qualquer empresa
-- 3. Usuários comuns criar apenas para sua própria empresa
CREATE POLICY "Users can create tickets"
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admin pode criar para qualquer empresa
  is_admin(auth.uid())
  OR 
  -- Técnico pode criar para qualquer empresa
  has_role(auth.uid(), 'tecnico'::user_role)
  OR
  -- Usuário comum só pode criar para sua própria empresa
  (company_id = get_user_company_id(auth.uid()))
);