-- Criar buckets de armazenamento para fotos
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('daily-service-photos', 'daily-service-photos', true),
  ('service-order-photos', 'service-order-photos', true);

-- Políticas RLS para bucket daily-service-photos
CREATE POLICY "Usuários autenticados podem fazer upload de fotos de atendimento"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'daily-service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem ver fotos de atendimento"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'daily-service-photos');

CREATE POLICY "Usuários podem deletar suas próprias fotos de atendimento"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'daily-service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins podem deletar qualquer foto de atendimento"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'daily-service-photos' AND is_admin(auth.uid()));

-- Políticas RLS para bucket service-order-photos
CREATE POLICY "Usuários autenticados podem fazer upload de fotos de OS"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-order-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem ver fotos de OS"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-order-photos');

CREATE POLICY "Usuários podem deletar suas próprias fotos de OS"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-order-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins podem deletar qualquer foto de OS"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-order-photos' AND is_admin(auth.uid()));

-- Adicionar coluna fotos na tabela daily_service_records
ALTER TABLE public.daily_service_records 
ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.daily_service_records.fotos IS 'Array JSON de fotos do atendimento: [{url, name, uploaded_at}]';

-- Adicionar coluna fotos na tabela service_orders
ALTER TABLE public.service_orders 
ADD COLUMN fotos jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.service_orders.fotos IS 'Array JSON de fotos da ordem de serviço: [{url, name, uploaded_at}]';