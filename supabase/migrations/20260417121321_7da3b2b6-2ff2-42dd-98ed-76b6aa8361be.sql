UPDATE public.tickets SET asset_id = NULL WHERE asset_id = 'c4eab922-403c-476a-a4c4-ed2c67136301';
UPDATE public.service_orders SET asset_id = NULL WHERE asset_id = 'c4eab922-403c-476a-a4c4-ed2c67136301';
UPDATE public.daily_service_records SET asset_id = NULL WHERE asset_id = 'c4eab922-403c-476a-a4c4-ed2c67136301';
DELETE FROM public.assets WHERE id = 'c4eab922-403c-476a-a4c4-ed2c67136301';