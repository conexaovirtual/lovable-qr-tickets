-- PHASE 2: SECURITY FIX - Allow users to view profiles within their company
-- This prevents cross-company data access while enabling collaboration within the same company

-- Add policy to allow users to view profiles from the same company
CREATE POLICY "Users can view profiles in their company" 
ON public.profiles 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Note: Existing policies remain:
-- 1. "Users can view own profile" - allows viewing own profile (redundant but harmless)
-- 2. "Admins can view all profiles" - admins can see all profiles across companies
-- 3. This new policy allows users to see profiles within their company for:
--    - Viewing ticket requesters and assigned technicians
--    - Collaboration features
--    - Company directory access