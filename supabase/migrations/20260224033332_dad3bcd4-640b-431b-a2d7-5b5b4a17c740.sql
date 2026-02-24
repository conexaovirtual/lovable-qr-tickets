
-- Tabela de conversas WhatsApp Business API
CREATE TABLE public.waba_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca por telefone
CREATE UNIQUE INDEX idx_waba_conversations_phone ON public.waba_conversations(phone_number);

-- Tabela de mensagens
CREATE TABLE public.waba_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.waba_conversations(id) ON DELETE CASCADE,
  wamid text, -- WhatsApp Message ID from Meta
  direction text NOT NULL DEFAULT 'inbound', -- inbound or outbound
  message_type text NOT NULL DEFAULT 'text', -- text, image, audio, video, document
  content text,
  media_url text,
  status text DEFAULT 'sent', -- sent, delivered, read, failed
  raw_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_waba_messages_conversation ON public.waba_messages(conversation_id);
CREATE INDEX idx_waba_messages_created ON public.waba_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.waba_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waba_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies - apenas admins e técnicos
CREATE POLICY "Admins and technicians can manage waba_conversations"
  ON public.waba_conversations FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

CREATE POLICY "Admins and technicians can manage waba_messages"
  ON public.waba_messages FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- Service role pode inserir (webhook)
CREATE POLICY "System can insert waba_conversations"
  ON public.waba_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert waba_messages"
  ON public.waba_messages FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.waba_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waba_conversations;

-- Trigger para updated_at
CREATE TRIGGER update_waba_conversations_updated_at
  BEFORE UPDATE ON public.waba_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
