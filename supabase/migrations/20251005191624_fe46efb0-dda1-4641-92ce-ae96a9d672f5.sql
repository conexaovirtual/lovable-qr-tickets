-- Fix infinite recursion by creating RLS-free helper table
-- Step 1: Create profiles_company_mapping table WITHOUT RLS
CREATE TABLE IF NOT EXISTS public.profiles_company_mapping (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Copy existing data from profiles
INSERT INTO public.profiles_company_mapping (user_id, company_id)
SELECT id, company_id FROM public.profiles
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

-- Step 3: Create trigger to keep mapping synchronized
CREATE OR REPLACE FUNCTION public.sync_company_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the mapping
  INSERT INTO public.profiles_company_mapping (user_id, company_id)
  VALUES (NEW.id, NEW.company_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    company_id = EXCLUDED.company_id,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Step 4: Attach trigger to profiles table
DROP TRIGGER IF EXISTS sync_company_mapping_trigger ON public.profiles;
CREATE TRIGGER sync_company_mapping_trigger
AFTER INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_mapping();

-- Step 5: Update get_user_company_id to use RLS-free table
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles_company_mapping WHERE user_id = _user_id;
$$;