-- Fix: Tickets RLS policies are causing recursion by querying profiles table
-- Solution: Use get_user_company_id() function instead of direct subqueries

-- Drop old policies
DROP POLICY IF EXISTS "Users can view tickets from their company" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;

-- Recreate policies using get_user_company_id()
CREATE POLICY "Users can view tickets from their company"
ON public.tickets
FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid()) 
  OR is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'tecnico'::user_role)
);

CREATE POLICY "Users can create tickets"
ON public.tickets
FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));