-- Fix: The "Block anonymous access" policy is blocking ALL access, even authenticated users
-- We need to change it to only block truly anonymous users

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Create a proper policy that only blocks unauthenticated access
CREATE POLICY "Block unauthenticated access to profiles" 
ON public.profiles 
FOR ALL
USING (auth.uid() IS NOT NULL);