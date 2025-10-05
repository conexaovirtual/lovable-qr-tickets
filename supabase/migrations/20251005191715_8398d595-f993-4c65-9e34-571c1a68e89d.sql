-- Enable RLS on profiles_company_mapping table
ALTER TABLE public.profiles_company_mapping ENABLE ROW LEVEL SECURITY;

-- No policies needed - this table is only accessed via SECURITY DEFINER functions
-- which bypass RLS. This prevents users from directly querying the table while
-- still allowing our trusted functions to use it.