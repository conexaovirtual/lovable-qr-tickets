-- Fix search_path for set_service_order_numero function
CREATE OR REPLACE FUNCTION set_service_order_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_os IS NULL THEN
    NEW.numero_os := nextval('service_orders_numero_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;