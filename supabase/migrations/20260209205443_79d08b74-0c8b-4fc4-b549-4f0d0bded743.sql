
-- Add Datto RMM fields to assets table
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS datto_device_id text,
ADD COLUMN IF NOT EXISTS datto_device_uid text,
ADD COLUMN IF NOT EXISTS datto_site_id text,
ADD COLUMN IF NOT EXISTS datto_last_sync timestamp with time zone,
ADD COLUMN IF NOT EXISTS datto_status text;

-- Create index for fast lookup by datto_device_id
CREATE INDEX IF NOT EXISTS idx_assets_datto_device_id ON public.assets (datto_device_id) WHERE datto_device_id IS NOT NULL;

-- Create datto_alerts_log table
CREATE TABLE IF NOT EXISTS public.datto_alerts_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_uid text,
  device_id text,
  asset_id uuid REFERENCES public.assets(id),
  ticket_id uuid REFERENCES public.tickets(id),
  alert_type text,
  alert_category text,
  alert_message text,
  alert_priority text,
  device_hostname text,
  device_ip text,
  site_name text,
  raw_payload jsonb,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datto_alerts_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for datto_alerts_log
CREATE POLICY "Admins and technicians can view datto alerts"
ON public.datto_alerts_log
FOR SELECT
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

CREATE POLICY "Admins and technicians can manage datto alerts"
ON public.datto_alerts_log
FOR ALL
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- Allow service role inserts (from edge function)
CREATE POLICY "Service role can insert datto alerts"
ON public.datto_alerts_log
FOR INSERT
WITH CHECK (true);
