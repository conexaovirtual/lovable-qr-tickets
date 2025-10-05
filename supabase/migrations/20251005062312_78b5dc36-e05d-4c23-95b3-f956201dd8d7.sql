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

-- Definir o primeiro usuário como administrador
UPDATE public.profiles 
SET role = 'admin_provedor'
WHERE id = (
  SELECT id FROM public.profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);