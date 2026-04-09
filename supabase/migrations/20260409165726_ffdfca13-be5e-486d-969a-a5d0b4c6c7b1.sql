-- Add explicit WITH CHECK to the UPDATE policy for daily_service_records
DROP POLICY IF EXISTS "Technicians can update their own records" ON public.daily_service_records;

CREATE POLICY "Technicians can update their own records"
ON public.daily_service_records
FOR UPDATE
TO authenticated
USING ((tecnico_id = auth.uid()) OR is_admin(auth.uid()))
WITH CHECK ((tecnico_id = auth.uid()) OR is_admin(auth.uid()));