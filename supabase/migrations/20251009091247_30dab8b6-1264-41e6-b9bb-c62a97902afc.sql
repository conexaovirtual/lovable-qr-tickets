-- Fix and recreate the handle_new_user trigger to accept company_id and role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  is_first_user boolean;
  internal_company_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  user_company_id uuid;
  user_role user_role;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) = 0 INTO is_first_user FROM profiles;
  
  -- Get company_id and role from metadata if provided
  user_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  user_role := (NEW.raw_user_meta_data->>'role')::user_role;
  
  -- Insert profile with company_id from metadata or internal for first user
  INSERT INTO public.profiles (id, nome, company_id, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    CASE 
      WHEN is_first_user THEN internal_company_id
      ELSE user_company_id
    END,
    NEW.raw_user_meta_data->>'telefone'
  );
  
  -- Assign role from metadata or default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    CASE 
      WHEN is_first_user THEN 'admin_provedor'::user_role
      WHEN user_role IS NOT NULL THEN user_role
      ELSE 'solicitante'::user_role
    END
  );
  
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();