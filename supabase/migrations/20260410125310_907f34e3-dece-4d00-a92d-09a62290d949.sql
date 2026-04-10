
-- Step 1: Clear datto_site_id from the duplicate company
UPDATE public.companies 
SET datto_site_id = NULL
WHERE id = '28bcd7ac-2db7-465a-85d2-3030eb568e72';

-- Step 2: Set correct datto_site_id on the real company
UPDATE public.companies 
SET datto_site_id = '113974'
WHERE id = '28710adc-0827-416d-afa5-ffd5fb11cb7e';

-- Step 3: Reassign all assets to the correct company
UPDATE public.assets 
SET company_id = '28710adc-0827-416d-afa5-ffd5fb11cb7e'
WHERE company_id = '28bcd7ac-2db7-465a-85d2-3030eb568e72' 
  AND datto_site_id = '113974';
