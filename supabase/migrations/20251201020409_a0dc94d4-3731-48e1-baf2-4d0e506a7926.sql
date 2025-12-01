-- Criar tabela de push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- RLS Policies para push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Adicionar campo notified_at em service_orders
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_service_orders_notified ON public.service_orders(data_agendada, notified_at) WHERE notified_at IS NULL;

-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para lembretes às 8h da manhã
SELECT cron.schedule(
  'check-service-orders-morning',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://plyzicpwvcqheubiidvn.supabase.co/functions/v1/check-service-orders-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseXppY3B3dmNxaGV1YmlpZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1Njc1MTMsImV4cCI6MjA3NTE0MzUxM30.49zPgFfowogEgEqicRuC2-cRS9reMX6J32HoRmKiTgs"}'::jsonb
  ) AS request_id;
  $$
);

-- Configurar cron job para lembretes ao meio-dia
SELECT cron.schedule(
  'check-service-orders-noon',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://plyzicpwvcqheubiidvn.supabase.co/functions/v1/check-service-orders-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseXppY3B3dmNxaGV1YmlpZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1Njc1MTMsImV4cCI6MjA3NTE0MzUxM30.49zPgFfowogEgEqicRuC2-cRS9reMX6J32HoRmKiTgs"}'::jsonb
  ) AS request_id;
  $$
);