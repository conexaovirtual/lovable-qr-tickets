
-- Add geolocation columns to daily_service_records
ALTER TABLE public.daily_service_records
  ADD COLUMN IF NOT EXISTS latitude_inicio double precision,
  ADD COLUMN IF NOT EXISTS longitude_inicio double precision,
  ADD COLUMN IF NOT EXISTS latitude_fim double precision,
  ADD COLUMN IF NOT EXISTS longitude_fim double precision,
  ADD COLUMN IF NOT EXISTS endereco_cliente text;

-- Add geolocation columns to service_orders
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS latitude_inicio double precision,
  ADD COLUMN IF NOT EXISTS longitude_inicio double precision,
  ADD COLUMN IF NOT EXISTS latitude_fim double precision,
  ADD COLUMN IF NOT EXISTS longitude_fim double precision;
