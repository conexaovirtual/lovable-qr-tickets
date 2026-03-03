-- First, deduplicate existing mabbix-generated wamids by keeping only the oldest
DELETE FROM public.waba_messages 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY wamid ORDER BY created_at ASC) as rn
    FROM public.waba_messages
    WHERE wamid IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_waba_messages_wamid_unique 
ON public.waba_messages (wamid) 
WHERE wamid IS NOT NULL;