
-- Add AI control fields to conversations
ALTER TABLE public.waba_conversations 
ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS ai_context jsonb DEFAULT '{}';

-- Add sender info to messages  
ALTER TABLE public.waba_messages
ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'user';
-- sender_type: 'user' (cliente), 'ai' (resposta IA), 'agent' (técnico humano)
