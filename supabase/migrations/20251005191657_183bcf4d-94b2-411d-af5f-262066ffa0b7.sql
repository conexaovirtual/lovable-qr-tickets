-- Enable RLS on profiles_company_mapping table
-- This table is used internally by security definer functions only
-- Users should not query this table directly

ALTER TABLE public.profiles_company_mapping ENABLE ROW LEVEL SECURITY;

-- Block all direct access - this table is only accessed via security definer functions
CREATE POLICY "Block all direct access to company mapping"
ON public.profiles_company_mapping
FOR ALL
USING (false);