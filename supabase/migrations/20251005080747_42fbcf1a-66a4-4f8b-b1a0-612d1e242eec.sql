-- Drop the policy first, then the function
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles from same company" ON profiles;

DROP FUNCTION IF EXISTS public.user_company_id(_user_id uuid);

-- Create simple non-recursive policies
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));