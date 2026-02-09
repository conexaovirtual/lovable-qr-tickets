
-- Remove overly permissive INSERT policy and replace with a restrictive one
DROP POLICY IF EXISTS "Service role can insert datto alerts" ON public.datto_alerts_log;
-- The edge function uses service_role key which bypasses RLS, so no public INSERT policy needed
