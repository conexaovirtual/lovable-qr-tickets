-- Fix infinite recursion in profiles RLS policies
-- Step 1: Create helper function to get user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id;
$$;

-- Step 2: Drop problematic policies
DROP POLICY IF EXISTS "Users can update own profile non-sensitive fields" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company with privacy rules" ON public.profiles;

-- Step 3: Recreate UPDATE policy without recursion
CREATE POLICY "Users can update own profile non-sensitive fields"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- Step 4: Recreate SELECT policy without recursion
CREATE POLICY "Users can view profiles in their company with privacy rules"
ON public.profiles
FOR SELECT
USING (
  is_admin(auth.uid()) 
  OR company_id = public.get_user_company_id(auth.uid())
);