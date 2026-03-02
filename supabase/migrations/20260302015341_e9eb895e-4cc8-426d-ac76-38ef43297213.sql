
-- Add modalidade column to service_orders
ALTER TABLE public.service_orders 
  ADD COLUMN modalidade text DEFAULT 'presencial';

-- Add check constraint via trigger for flexibility
CREATE OR REPLACE FUNCTION public.validate_service_order_modalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.modalidade NOT IN ('remoto', 'presencial') THEN
    RAISE EXCEPTION 'modalidade must be remoto or presencial';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_modalidade_trigger
  BEFORE INSERT OR UPDATE ON public.service_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_order_modalidade();
