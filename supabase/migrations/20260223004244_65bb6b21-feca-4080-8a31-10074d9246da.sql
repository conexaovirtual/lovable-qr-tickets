
-- Table to store WhatsApp Evolution API configuration
CREATE TABLE public.whatsapp_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name text NOT NULL,
  instance_id text,
  status text DEFAULT 'disconnected',
  webhook_configured boolean DEFAULT false,
  auto_create_ticket boolean DEFAULT true,
  auto_notify_updates boolean DEFAULT true,
  default_greeting text DEFAULT 'Olá! Seu chamado foi recebido. Em breve um técnico irá atendê-lo.',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage whatsapp config"
ON public.whatsapp_config
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Table to map WhatsApp numbers to companies/contacts
CREATE TABLE public.whatsapp_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL UNIQUE,
  contact_name text,
  company_id uuid REFERENCES public.companies(id),
  last_message_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can manage whatsapp contacts"
ON public.whatsapp_contacts
FOR ALL
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- Table to log WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remote_jid text NOT NULL,
  message_id text,
  from_me boolean DEFAULT false,
  message_type text DEFAULT 'text',
  content text,
  ticket_id uuid REFERENCES public.tickets(id),
  contact_id uuid REFERENCES public.whatsapp_contacts(id),
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can view whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

CREATE POLICY "System can insert whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);
