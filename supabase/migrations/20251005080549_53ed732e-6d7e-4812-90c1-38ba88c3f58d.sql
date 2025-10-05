-- Fix infinite recursion in profiles policies
-- The issue is the SELECT policy queries profiles table within itself

-- First, create a security definer function to check company access
CREATE OR REPLACE FUNCTION public.user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id;
$$;

-- Drop and recreate the problematic SELECT policy without recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR is_admin(auth.uid()) 
  OR (company_id = user_company_id(auth.uid()) AND company_id IS NOT NULL)
);