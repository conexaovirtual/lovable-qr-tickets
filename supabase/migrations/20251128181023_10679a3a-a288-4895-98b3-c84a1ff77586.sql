-- Add asset_id column to service_orders table
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_service_orders_asset_id ON public.service_orders(asset_id);

-- Add comment
COMMENT ON COLUMN public.service_orders.asset_id IS 'Ativo vinculado à ordem de serviço (obrigatório)';