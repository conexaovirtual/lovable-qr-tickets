-- PHASE 3: SECURITY IMPROVEMENTS - Optimize RLS Policies
-- Remove redundant "Users can view own profile" policy since "Users can view profiles in their company" already covers this case

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Add explanatory comment to the remaining policy
COMMENT ON POLICY "Users can view profiles in their company" ON public.profiles IS 
'Allows users to view profiles within their company, including their own profile. Admins have a separate policy for global access.';